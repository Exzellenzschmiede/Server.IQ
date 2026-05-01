from pydantic import BaseModel


class NginxStatus(BaseModel):
    available: bool
    version: str | None = None
    running: bool = False
    config_test_ok: bool | None = None


class NginxSite(BaseModel):
    name: str
    path: str
    enabled: bool
    is_default: bool = False


class NginxSiteList(BaseModel):
    sites: list[NginxSite]


class NginxConfigResponse(BaseModel):
    name: str
    content: str
    path: str


class NginxWriteRequest(BaseModel):
    name: str
    content: str


class NginxTestResult(BaseModel):
    ok: bool
    output: str


class NginxActionResult(BaseModel):
    ok: bool
    message: str
