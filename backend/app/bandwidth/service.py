from datetime import datetime, timezone
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.bandwidth.schemas import BandwidthDay, BandwidthResponse
from app.models import MetricSnapshot

_INTERVAL_SECONDS = 60  # snapshots are taken every 60 s


async def get_bandwidth(db: AsyncSession, days: int = 30) -> BandwidthResponse:
    result = await db.execute(
        select(MetricSnapshot)
        .order_by(MetricSnapshot.recorded_at.desc())
        .limit(days * 24 * 60)  # at most days * 1440 snapshots
    )
    snapshots = result.scalars().all()

    daily: dict[str, dict[str, int]] = defaultdict(lambda: {"recv": 0, "sent": 0})

    for snap in snapshots:
        ts = snap.recorded_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        day = ts.strftime("%Y-%m-%d")
        daily[day]["recv"] += int(snap.net_recv_bps * _INTERVAL_SECONDS)
        daily[day]["sent"] += int(snap.net_sent_bps * _INTERVAL_SECONDS)

    sorted_days = sorted(daily.keys())[-days:]
    day_list = [
        BandwidthDay(date=d, recv_bytes=daily[d]["recv"], sent_bytes=daily[d]["sent"])
        for d in sorted_days
    ]

    total_recv = sum(d.recv_bytes for d in day_list)
    total_sent = sum(d.sent_bytes for d in day_list)

    return BandwidthResponse(days=day_list, total_recv_bytes=total_recv, total_sent_bytes=total_sent)
