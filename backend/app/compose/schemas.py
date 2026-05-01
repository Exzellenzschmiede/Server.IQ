from pydantic import BaseModel


class ComposeProject(BaseModel):
    name: str
    path: str        # directory containing the compose file
    file: str        # full path to compose file
    services: list[str]
    status: str      # "running", "partial", "stopped", "unknown"


class ComposeActionResponse(BaseModel):
    success: bool
    project: str
    action: str
    output: str
