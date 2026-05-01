import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import AppConfig, User
from app.system.service import get_all_metrics, get_system_info, get_top_processes

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


def _build_server_context() -> str:
    try:
        metrics = get_all_metrics()
        info = get_system_info()

        # CPU
        cpu_line = f"CPU: {metrics.cpu.percent:.1f}% ({metrics.cpu.count} cores, load avg {metrics.load_avg.load_1:.2f}/{metrics.load_avg.load_5:.2f}/{metrics.load_avg.load_15:.2f})"

        # Memory
        mem = metrics.memory
        mem_used_gb = mem.used_bytes / 1e9
        mem_total_gb = mem.total_bytes / 1e9
        mem_line = f"RAM: {mem.percent:.1f}% used ({mem_used_gb:.1f} GB / {mem_total_gb:.1f} GB)"

        # Disk — all partitions
        disk_lines = []
        for d in metrics.disk:
            free_gb = d.free_bytes / 1e9
            total_gb = d.total_bytes / 1e9
            disk_lines.append(f"  {d.mountpoint}: {d.percent:.1f}% used, {free_gb:.1f} GB free of {total_gb:.1f} GB ({d.fstype})")
        disk_section = "Disk partitions:\n" + "\n".join(disk_lines) if disk_lines else "Disk: unknown"

        # Network throughput
        net_recv = sum(n.bytes_recv_per_sec for n in metrics.network) / 1024
        net_sent = sum(n.bytes_sent_per_sec for n in metrics.network) / 1024
        net_line = f"Network: ↓{net_recv:.1f} KB/s ↑{net_sent:.1f} KB/s, {metrics.tcp_connections} TCP connections"

        # Top processes
        procs = get_top_processes("cpu", 5)
        proc_lines = [f"  {p.pid} {p.name} cpu={p.cpu_percent:.1f}% mem={p.memory_percent:.1f}%" for p in procs]
        proc_section = "Top processes (by CPU):\n" + "\n".join(proc_lines) if proc_lines else ""

        return (
            f"Server: {info.hostname} | {info.os} | kernel {info.kernel} | uptime {info.uptime_human}\n"
            f"{cpu_line}\n"
            f"{mem_line}\n"
            f"{disk_section}\n"
            f"{net_line}\n"
            f"{proc_section}"
        )
    except Exception as exc:
        return f"(context collection error: {exc})"


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    provider, model, api_key = await _get_ai_config(db)

    context = await asyncio.to_thread(_build_server_context)

    system = body.system_prompt or (
        "You are Server.IQ, an AI assistant embedded in a VPS admin console. "
        "You have real-time access to the server's current state — always use it to give specific, accurate answers.\n\n"
        f"=== LIVE SERVER DATA ===\n{context}\n=== END SERVER DATA ===\n\n"
        "Answer questions about this specific server concisely and accurately. "
        "When the user asks about disk, memory, CPU, processes, etc., use the data above. "
        "Suggest concrete next steps when helpful."
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
        f"You are a Linux server log analyst.{context_hint} "
        "Analyze the provided log excerpt. Identify errors, warnings, anomalies, "
        "security concerns, and unusual patterns. Be concise and actionable. "
        "Group findings by severity (Critical / Warning / Info)."
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
    raw = await call_ai(provider, model, api_key, system, messages)
    expression, explanation = parse_cron_response(raw)
    return CronHelpResponse(expression=expression, explanation=explanation, provider=provider, model=model)
