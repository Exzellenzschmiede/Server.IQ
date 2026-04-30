from pydantic import BaseModel


class FirewallRule(BaseModel):
    num: int
    to: str
    action: str
    from_: str


class FirewallStatus(BaseModel):
    enabled: bool
    rules: list[FirewallRule]
    error: str | None = None


class AddRuleRequest(BaseModel):
    port: str
    protocol: str = "tcp"
    action: str = "allow"


class DeleteRuleRequest(BaseModel):
    num: int
