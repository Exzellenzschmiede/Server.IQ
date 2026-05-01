from pydantic import BaseModel


class BandwidthDay(BaseModel):
    date: str       # "YYYY-MM-DD"
    recv_bytes: int
    sent_bytes: int


class BandwidthResponse(BaseModel):
    days: list[BandwidthDay]
    total_recv_bytes: int
    total_sent_bytes: int
