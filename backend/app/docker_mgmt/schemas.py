from pydantic import BaseModel


class ContainerPort(BaseModel):
    container_port: str
    host_ip: str | None
    host_port: str | None


class ContainerInfo(BaseModel):
    id: str
    short_id: str
    name: str
    image: str
    status: str
    state: str
    created: str
    started_at: str | None
    ports: list[ContainerPort]
    labels: dict[str, str]


class ContainersResponse(BaseModel):
    containers: list[ContainerInfo]
    total: int
    running: int
    stopped: int


class ContainerActionResponse(BaseModel):
    success: bool
    container_id: str
    action: str
    message: str


class ReinstallResponse(BaseModel):
    success: bool
    container_id: str
    new_container_id: str | None
    image_pulled: bool
    message: str


class ImageInfo(BaseModel):
    id: str
    short_id: str
    tags: list[str]
    size_bytes: int
    created: str
