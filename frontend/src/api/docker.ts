import client from "./client";
import type {
  ContainerActionResponse,
  ContainerInfo,
  ContainerStats,
  ContainersResponse,
  ImageInfo,
  ReinstallResponse,
} from "../types/docker";

export async function getContainers(all = true): Promise<ContainersResponse> {
  const { data } = await client.get<ContainersResponse>("/docker/containers", {
    params: { all },
  });
  return data;
}

export async function getContainer(id: string): Promise<ContainerInfo> {
  const { data } = await client.get<ContainerInfo>(`/docker/containers/${id}`);
  return data;
}

export async function startContainer(id: string): Promise<ContainerActionResponse> {
  const { data } = await client.post<ContainerActionResponse>(
    `/docker/containers/${id}/start`
  );
  return data;
}

export async function stopContainer(id: string): Promise<ContainerActionResponse> {
  const { data } = await client.post<ContainerActionResponse>(
    `/docker/containers/${id}/stop`
  );
  return data;
}

export async function removeContainer(
  id: string,
  force = false
): Promise<ContainerActionResponse> {
  const { data } = await client.delete<ContainerActionResponse>(
    `/docker/containers/${id}`,
    { params: { force } }
  );
  return data;
}

export async function reinstallContainer(id: string): Promise<ReinstallResponse> {
  const { data } = await client.post<ReinstallResponse>(
    `/docker/containers/${id}/reinstall`
  );
  return data;
}

export async function restartContainer(id: string): Promise<ContainerActionResponse> {
  const { data } = await client.post<ContainerActionResponse>(
    `/docker/containers/${id}/restart`
  );
  return data;
}

export async function getContainerStats(id: string): Promise<ContainerStats> {
  const { data } = await client.get<ContainerStats>(`/docker/containers/${id}/stats`);
  return data;
}

export async function getImages(): Promise<ImageInfo[]> {
  const { data } = await client.get<ImageInfo[]>("/docker/images");
  return data;
}
