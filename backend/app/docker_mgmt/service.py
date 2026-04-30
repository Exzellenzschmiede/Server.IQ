import re
from typing import AsyncGenerator

import aiodocker
from aiodocker.exceptions import DockerError
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


def _validate_id(container_id: str) -> None:
    if not _CONTAINER_ID_RE.match(container_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid container ID format",
        )


def _parse_list_container(data: dict) -> ContainerInfo:
    ports = []
    for p in data.get("Ports") or []:
        port_proto = f"{p.get('PrivatePort', '')}/{p.get('Type', 'tcp')}"
        pub_port = str(p["PublicPort"]) if p.get("PublicPort") else None
        ports.append(ContainerPort(
            container_port=port_proto,
            host_ip=p.get("IP"),
            host_port=pub_port,
        ))

    names = data.get("Names") or []
    name = names[0].lstrip("/") if names else ""
    container_id = data.get("Id", "")

    return ContainerInfo(
        id=container_id,
        short_id=container_id[:12],
        name=name,
        image=data.get("Image", ""),
        status=data.get("Status", ""),
        state=data.get("State", ""),
        created=str(data.get("Created", "")),
        started_at=None,
        ports=ports,
        labels=data.get("Labels") or {},
    )


def _parse_inspect_container(data: dict) -> ContainerInfo:
    state = data.get("State", {})
    config = data.get("Config", {})
    network_settings = data.get("NetworkSettings", {})

    ports = []
    for port_proto, bindings in (network_settings.get("Ports") or {}).items():
        if bindings:
            for b in bindings:
                ports.append(ContainerPort(
                    container_port=port_proto,
                    host_ip=b.get("HostIp"),
                    host_port=b.get("HostPort"),
                ))
        else:
            ports.append(ContainerPort(container_port=port_proto, host_ip=None, host_port=None))

    container_id = data.get("Id", "")
    return ContainerInfo(
        id=container_id,
        short_id=container_id[:12],
        name=data.get("Name", "").lstrip("/"),
        image=config.get("Image", ""),
        status=state.get("Status", ""),
        state=state.get("Status", ""),
        created=data.get("Created", ""),
        started_at=state.get("StartedAt"),
        ports=ports,
        labels=config.get("Labels") or {},
    )


async def list_containers(all_containers: bool = True) -> ContainersResponse:
    try:
        async with aiodocker.Docker() as docker:
            raw = await docker.containers.list(all=all_containers)
            containers = [_parse_list_container(c._container) for c in raw]
        running = sum(1 for c in containers if c.state == "running")
        return ContainersResponse(
            containers=containers,
            total=len(containers),
            running=running,
            stopped=len(containers) - running,
        )
    except DockerError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Cannot connect to Docker: {exc}",
        )


async def get_container(container_id: str) -> ContainerInfo:
    _validate_id(container_id)
    try:
        async with aiodocker.Docker() as docker:
            c = await docker.containers.get(container_id)
            data = await c.show()
        return _parse_inspect_container(data)
    except DockerError as exc:
        if exc.status == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Container not found")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


async def start_container(container_id: str) -> ContainerActionResponse:
    _validate_id(container_id)
    try:
        async with aiodocker.Docker() as docker:
            c = await docker.containers.get(container_id)
            await c.start()
        return ContainerActionResponse(
            success=True, container_id=container_id, action="start", message="Container started"
        )
    except DockerError as exc:
        if exc.status == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Container not found")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


async def stop_container(container_id: str) -> ContainerActionResponse:
    _validate_id(container_id)
    try:
        async with aiodocker.Docker() as docker:
            c = await docker.containers.get(container_id)
            await c.stop(t=10)
        return ContainerActionResponse(
            success=True, container_id=container_id, action="stop", message="Container stopped"
        )
    except DockerError as exc:
        if exc.status == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Container not found")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


async def remove_container(container_id: str, force: bool = False) -> ContainerActionResponse:
    _validate_id(container_id)
    try:
        async with aiodocker.Docker() as docker:
            c = await docker.containers.get(container_id)
            await c.delete(force=force)
        return ContainerActionResponse(
            success=True, container_id=container_id, action="remove", message="Container removed"
        )
    except DockerError as exc:
        if exc.status == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Container not found")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


async def reinstall_container(container_id: str) -> ReinstallResponse:
    _validate_id(container_id)
    try:
        async with aiodocker.Docker() as docker:
            c = await docker.containers.get(container_id)
            data = await c.show()
    except DockerError as exc:
        if exc.status == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Container not found")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    config = data.get("Config", {})
    host_config = data.get("HostConfig", {})
    image_name = config.get("Image", "")
    name = data.get("Name", "").lstrip("/")

    image_pulled = False
    new_id = None

    async with aiodocker.Docker() as docker:
        try:
            if ":" in image_name.split("/")[-1]:
                from_image, tag = image_name.rsplit(":", 1)
            else:
                from_image, tag = image_name, "latest"
            await docker.images.pull(from_image=from_image, tag=tag)
            image_pulled = True
        except Exception:
            pass

        c = await docker.containers.get(container_id)
        await c.stop(t=10)
        await c.delete()

        new_container = await docker.containers.run(
            config={
                "Image": image_name,
                "Env": config.get("Env") or [],
                "Labels": config.get("Labels") or {},
                "HostConfig": {
                    "PortBindings": host_config.get("PortBindings") or {},
                    "Binds": host_config.get("Binds") or [],
                    "RestartPolicy": host_config.get("RestartPolicy"),
                    "NetworkMode": host_config.get("NetworkMode"),
                },
            },
            name=name,
        )
        new_id = new_container._id or (new_container._container or {}).get("Id")

    return ReinstallResponse(
        success=True,
        container_id=container_id,
        new_container_id=new_id,
        image_pulled=image_pulled,
        message=f"Container reinstalled from image {image_name}",
    )


async def stream_logs(container_id: str, tail: int = 100) -> AsyncGenerator[str, None]:
    _validate_id(container_id)
    docker = aiodocker.Docker()
    try:
        c = await docker.containers.get(container_id)
        async for chunk in c.log(stdout=True, stderr=True, follow=True, tail=tail):
            if isinstance(chunk, bytes):
                yield chunk.decode("utf-8", errors="replace")
            else:
                yield str(chunk)
    except DockerError as exc:
        if exc.status == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Container not found")
    finally:
        await docker.close()


async def list_images() -> list[ImageInfo]:
    try:
        async with aiodocker.Docker() as docker:
            raw = await docker.images.list()
        result = []
        for d in raw:
            img_id = d.get("Id", "")
            result.append(ImageInfo(
                id=img_id,
                short_id=img_id[:19] if img_id.startswith("sha256:") else img_id[:12],
                tags=d.get("RepoTags") or [],
                size_bytes=d.get("Size", 0),
                created=str(d.get("Created", "")),
            ))
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Cannot connect to Docker: {exc}",
        )
