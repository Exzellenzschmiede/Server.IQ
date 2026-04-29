import re
from typing import Generator

import docker
from docker.errors import DockerException, NotFound
from fastapi import HTTPException, status

from app.docker_mgmt.schemas import (
    ContainerActionResponse,
    ContainerInfo,
    ContainerPort,
    ContainersResponse,
    ImageInfo,
    ReinstallResponse,
)

_CONTAINER_ID_RE = re.compile(r"^[a-f0-9]{12,64}$")


def _get_client() -> docker.DockerClient:
    try:
        return docker.from_env()
    except DockerException as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Cannot connect to Docker: {exc}",
        )


def _validate_id(container_id: str) -> None:
    if not _CONTAINER_ID_RE.match(container_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid container ID format",
        )


def _to_schema(container) -> ContainerInfo:
    ports = []
    for port_proto, bindings in (container.ports or {}).items():
        if bindings:
            for b in bindings:
                ports.append(
                    ContainerPort(
                        container_port=port_proto,
                        host_ip=b.get("HostIp"),
                        host_port=b.get("HostPort"),
                    )
                )
        else:
            ports.append(ContainerPort(container_port=port_proto, host_ip=None, host_port=None))

    attrs = container.attrs or {}
    state = attrs.get("State", {})
    image_tags = container.image.tags if container.image and container.image.tags else []
    image_str = image_tags[0] if image_tags else (container.attrs.get("Config", {}).get("Image", ""))

    return ContainerInfo(
        id=container.id,
        short_id=container.short_id,
        name=container.name.lstrip("/"),
        image=image_str,
        status=container.status,
        state=state.get("Status", container.status),
        created=attrs.get("Created", ""),
        started_at=state.get("StartedAt"),
        ports=ports,
        labels=container.labels or {},
    )


def list_containers(all_containers: bool = True) -> ContainersResponse:
    client = _get_client()
    containers = [_to_schema(c) for c in client.containers.list(all=all_containers)]
    running = sum(1 for c in containers if c.status == "running")
    return ContainersResponse(
        containers=containers,
        total=len(containers),
        running=running,
        stopped=len(containers) - running,
    )


def get_container(container_id: str) -> ContainerInfo:
    _validate_id(container_id)
    client = _get_client()
    try:
        return _to_schema(client.containers.get(container_id))
    except NotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Container not found")


def start_container(container_id: str) -> ContainerActionResponse:
    _validate_id(container_id)
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        container.start()
        return ContainerActionResponse(
            success=True, container_id=container_id, action="start", message="Container started"
        )
    except NotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Container not found")


def stop_container(container_id: str) -> ContainerActionResponse:
    _validate_id(container_id)
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        container.stop(timeout=10)
        return ContainerActionResponse(
            success=True, container_id=container_id, action="stop", message="Container stopped"
        )
    except NotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Container not found")


def remove_container(container_id: str, force: bool = False) -> ContainerActionResponse:
    _validate_id(container_id)
    client = _get_client()
    try:
        container = client.containers.get(container_id)
        container.remove(force=force)
        return ContainerActionResponse(
            success=True, container_id=container_id, action="remove", message="Container removed"
        )
    except NotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Container not found")


def reinstall_container(container_id: str) -> ReinstallResponse:
    _validate_id(container_id)
    client = _get_client()
    try:
        container = client.containers.get(container_id)
    except NotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Container not found")

    attrs = container.attrs or {}
    config = attrs.get("Config", {})
    host_config = attrs.get("HostConfig", {})
    image_name = config.get("Image", "")
    name = container.name.lstrip("/")

    image_pulled = False
    try:
        client.images.pull(image_name)
        image_pulled = True
    except DockerException:
        pass

    container.stop(timeout=10)
    container.remove()

    new_container = client.containers.run(
        image_name,
        name=name,
        detach=True,
        environment=config.get("Env") or [],
        ports=host_config.get("PortBindings") or {},
        volumes=host_config.get("Binds") or [],
        restart_policy=host_config.get("RestartPolicy"),
        labels=config.get("Labels") or {},
        network_mode=host_config.get("NetworkMode"),
    )

    return ReinstallResponse(
        success=True,
        container_id=container_id,
        new_container_id=new_container.id,
        image_pulled=image_pulled,
        message=f"Container reinstalled from image {image_name}",
    )


def stream_logs(container_id: str, tail: int = 100) -> Generator[str, None, None]:
    _validate_id(container_id)
    client = _get_client()
    try:
        container = client.containers.get(container_id)
    except NotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Container not found")

    for chunk in container.logs(stream=True, follow=True, tail=tail):
        line = chunk.decode("utf-8", errors="replace")
        yield line


def list_images() -> list[ImageInfo]:
    client = _get_client()
    result = []
    for img in client.images.list():
        attrs = img.attrs or {}
        result.append(
            ImageInfo(
                id=img.id,
                short_id=img.short_id,
                tags=img.tags or [],
                size_bytes=attrs.get("Size", 0),
                created=attrs.get("Created", ""),
            )
        )
    return result
