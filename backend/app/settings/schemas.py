from pydantic import BaseModel


class ServiceConfigOut(BaseModel):
    id: int
    key: str
    display_name: str
    host: str | None
    port: int | None
    enabled: bool

    model_config = {"from_attributes": True}


class ServiceConfigCreate(BaseModel):
    key: str
    display_name: str
    host: str | None = None
    port: int | None = None
    enabled: bool = True


class ServiceConfigUpdate(BaseModel):
    display_name: str | None = None
    host: str | None = None
    port: int | None = None
    enabled: bool | None = None
