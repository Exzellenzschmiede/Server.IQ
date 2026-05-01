from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import AppConfig, User
from app.system.service import get_all_metrics, get_system_info

from .schemas import (
    AnalyzeLogsRequest,
    AnalyzeLogsResponse,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    CronHelpRequest,
    CronHelpResponse,
    PROVIDER_MODELS,
)
from .service import call_ai, parse_cron_response

router = APIRouter()


async def _get_ai_config(db: AsyncSession) -> tuple[str, str, str]:
    cfg = await db.scalar(select(AppConfig).where(AppConfig.id == 1))
    if not cfg or not cfg.ai_provider or not cfg.ai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI is not configured. Add a provider and API key in Settings.",
        )
    model = cfg.ai_model or (PROVIDER_MODELS.get(cfg.ai_provider, [""])[0])
    return cfg.ai_provider, model, cfg.ai_api_key


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    provider, model, api_key = await _get_ai_config(db)

    # Build system prompt with live server context
    try:
        metrics = get_all_metrics()
        info = get_system_info()
        cpu = metrics.cpu.percent
        ram = metrics.memory.percent
        disk_pct = metrics.disk[0].percent if metrics.disk else 0
        disk_used = metrics.disk[0].used if metrics.disk else 0
        context = (
            f"Hostname: {info.hostname}, OS: {info.os}, Kernel: {info.kernel}, "
            f"Uptime: {info.uptime_human}. "
            f"CPU: {cpu:.1f}%, RAM: {ram:.1f}%, Disk: {disk_pct:.1f}% used ({disk_used / 1e9:.1f} GB)."
        )
    except Exception:
        context = "Server context unavailable."

    system = (
        body.system_prompt
        or (
            "You are Server.IQ, an intelligent assistant for a Linux VPS admin console. "
            f"Current server snapshot: {context} "
            "Answer questions about the server concisely. When relevant, suggest actionable commands or next steps."
        )
    )

    reply = await call_ai(provider, model, api_key, system, body.messages)
    return ChatResponse(reply=reply, provider=provider, model=model)


@router.post("/analyze-logs", response_model=AnalyzeLogsResponse)
async def analyze_logs(
    body: AnalyzeLogsRequest,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    provider, model, api_key = await _get_ai_config(db)
    context_hint = f" Context: {body.context}." if body.context else ""
    system = (
        "You are a Linux server log analyst.{} "
        "Analyze the provided log excerpt. Identify errors, warnings, anomalies, "
        "security concerns, and unusual patterns. Be concise and actionable. "
        "Group findings by severity (Critical / Warning / Info).".format(context_hint)
    )
    messages = [ChatMessage(role="user", content=f"Analyze these logs:\n\n```\n{body.logs[:8000]}\n```")]
    analysis = await call_ai(provider, model, api_key, system, messages)
    return AnalyzeLogsResponse(analysis=analysis, provider=provider, model=model)


@router.post("/cron-help", response_model=CronHelpResponse)
async def cron_help(
    body: CronHelpRequest,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    provider, model, api_key = await _get_ai_config(db)
    system = (
        "You are a cron expression expert. "
        "The user describes a schedule in natural language. "
        "Reply with ONLY the cron expression on the first line (standard 5-field format: min hour day month weekday), "
        "then a blank line, then a plain-English explanation of when it runs. "
        "Do not include any other text before the expression."
    )
    messages = [ChatMessage(role="user", content=body.description)]
    text = await call_ai(provider, model, api_key, system, messages)
    expression, explanation = parse_cron_response(text)
    return CronHelpResponse(expression=expression, explanation=explanation, provider=provider, model=model)
