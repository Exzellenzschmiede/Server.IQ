from pydantic import BaseModel


class Fail2banJail(BaseModel):
    name: str
    currently_failed: int
    total_failed: int
    currently_banned: int
    total_banned: int
    banned_ips: list[str]


class Fail2banStatus(BaseModel):
    available: bool
    active: bool
    jails: list[Fail2banJail]


class UnbanRequest(BaseModel):
    jail: str
    ip: str


class UnbanResponse(BaseModel):
    success: bool
    message: str
