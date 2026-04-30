from pydantic import BaseModel


class CertInfo(BaseModel):
    domain: str
    not_before: str
    not_after: str
    days_remaining: int
    expired: bool
