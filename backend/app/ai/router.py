import asyncio
import json
import re
import subprocess

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import AppConfig, User
from app.system.service import get_all_metrics, get_system_info, get_top_processes

from .schemas import (
    AgentExecutionResult,
    AgentRequest,
    AgentResponse,
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

        uptime_h = int(info.uptime_seconds // 3600)
        uptime_m = int((info.uptime_seconds % 3600) // 60)
        uptime_str = f"{uptime_h}h {uptime_m}m"
        return (
            f"Server: {info.hostname} | {info.os_name} | kernel {info.kernel_version} | uptime {uptime_str}\n"
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


_MAX_AGENT_ITERATIONS = 8
_AGENT_CMD_TIMEOUT = 30


def _run_shell(cmd: str) -> AgentExecutionResult:
    try:
        result = subprocess.run(
            ["bash", "-c", cmd],
            capture_output=True,
            text=True,
            timeout=_AGENT_CMD_TIMEOUT,
        )
        return AgentExecutionResult(
            command=cmd,
            stdout=result.stdout[:4000],
            stderr=result.stderr[:1000],
            exit_code=result.returncode,
        )
    except subprocess.TimeoutExpired:
        return AgentExecutionResult(command=cmd, stdout="", stderr=f"Command timed out after {_AGENT_CMD_TIMEOUT}s", exit_code=-1)
    except Exception as exc:
        return AgentExecutionResult(command=cmd, stdout="", stderr=str(exc), exit_code=-1)


@router.post("/agent", response_model=AgentResponse)
async def agent(
    body: AgentRequest,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    provider, model, api_key = await _get_ai_config(db)
    context = await asyncio.to_thread(_build_server_context)

    system = (
        "You are Server.IQ Agent, an AI assistant embedded in a VPS admin console with the ability to execute "
        "shell commands directly on this server.\n\n"
        "When you need to run a command, embed it like this: <execute>your command here</execute>\n"
        "You may include multiple <execute> blocks in one response.\n"
        "After each round of executions you will receive the output and can continue or provide a final answer.\n\n"
        "Guidelines:\n"
        "- Briefly state what you are about to do before executing commands\n"
        "- Prefer targeted, reversible commands; avoid destructive operations unless explicitly asked\n"
        "- If a command fails, diagnose and try an alternative approach\n"
        "- When done, give a clear summary of what was accomplished\n\n"
        f"=== LIVE SERVER DATA ===\n{context}\n=== END SERVER DATA ==="
    )

    messages: list[ChatMessage] = list(body.messages)
    all_executions: list[AgentExecutionResult] = []

    for _ in range(_MAX_AGENT_ITERATIONS):
        reply = await call_ai(provider, model, api_key, system, messages)
        blocks = re.findall(r"<execute>(.*?)</execute>", reply, re.DOTALL)

        if not blocks:
            return AgentResponse(reply=reply, executions=all_executions, provider=provider, model=model)

        messages.append(ChatMessage(role="assistant", content=reply))

        result_parts: list[str] = []
        for cmd in blocks:
            cmd = cmd.strip()
            res = await asyncio.to_thread(_run_shell, cmd)
            all_executions.append(res)
            result_parts.append(
                f"<result command={json.dumps(cmd)}>\n"
                f"exit_code: {res.exit_code}\n"
                f"stdout:\n{res.stdout}\n"
                f"stderr:\n{res.stderr}\n"
                f"</result>"
            )

        messages.append(ChatMessage(role="user", content="\n\n".join(result_parts)))

    return AgentResponse(
        reply="Agent reached the maximum number of iterations without completing the task.",
        executions=all_executions,
        provider=provider,
        model=model,
    )
