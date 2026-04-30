import re
import subprocess

from fastapi import HTTPException, status

from .schemas import CronJob, CronListResponse

_SCHEDULE_RE = re.compile(
    r"^(@(reboot|yearly|annually|monthly|weekly|daily|hourly)|"
    r"(\*|[0-9,\-\*\/]+)\s+(\*|[0-9,\-\*\/]+)\s+(\*|[0-9,\-\*\/]+)\s+(\*|[0-9,\-\*\/]+)\s+(\*|[0-9,\-\*\/]+))$"
)


def _get_raw() -> str:
    r = subprocess.run(["crontab", "-l"], capture_output=True, text=True, timeout=10)
    if r.returncode != 0 and "no crontab" in r.stderr.lower():
        return ""
    return r.stdout


def _set_raw(content: str) -> None:
    r = subprocess.run(["crontab", "-"], input=content, capture_output=True, text=True, timeout=10)
    if r.returncode != 0:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=r.stderr.strip() or "crontab write failed")


def _parse_jobs(raw: str) -> tuple[list[CronJob], str]:
    jobs = []
    header_lines = []
    job_index = 0
    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            header_lines.append(line)
            continue
        parts = stripped.split(None, 6)
        if len(parts) < 6:
            header_lines.append(line)
            continue
        schedule = " ".join(parts[:5])
        command = parts[5] if len(parts) > 5 else ""
        comment = ""
        if "#" in command:
            command, _, comment = command.partition("#")
            command = command.strip()
            comment = comment.strip()
        jobs.append(CronJob(index=job_index, raw=line, schedule=schedule, command=command, comment=comment))
        job_index += 1
    return jobs, "\n".join(header_lines)


def list_jobs() -> CronListResponse:
    raw = _get_raw()
    jobs, header = _parse_jobs(raw)
    return CronListResponse(jobs=jobs, raw_header=header)


def add_job(schedule: str, command: str) -> CronJob:
    if not _SCHEDULE_RE.match(schedule.strip()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cron schedule format")
    if not command.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Command cannot be empty")
    if "\n" in command or "\r" in command:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Command must be a single line")

    raw = _get_raw()
    new_line = f"{schedule.strip()} {command.strip()}"
    new_raw = (raw.rstrip("\n") + "\n" + new_line + "\n") if raw else new_line + "\n"
    _set_raw(new_raw)
    jobs, _ = _parse_jobs(new_raw)
    return jobs[-1]


def delete_job(index: int) -> dict:
    raw = _get_raw()
    jobs, _ = _parse_jobs(raw)
    if index < 0 or index >= len(jobs):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    target_raw = jobs[index].raw
    new_lines = [l for l in raw.splitlines() if l != target_raw]
    _set_raw("\n".join(new_lines) + "\n")
    return {"success": True, "deleted_index": index}
