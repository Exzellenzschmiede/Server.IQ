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
    status: str        # machine-readable: "running", "exited", etc.
    status_text: str   # human-readable: "Up 2 hours", "Exited (0) 3m ago"
    state: str
    created: str
    started_at: str | None
    ports: list[ContainerPort]
    labels: dict[str, str]
    volumes: list[str]
    networks: list[str]
    restart_policy: str | None


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


class ContainerStats(BaseModel):
    container_id: str
    cpu_percent: float
    memory_bytes: int
    memory_limit_bytes: int
    memory_percent: float
