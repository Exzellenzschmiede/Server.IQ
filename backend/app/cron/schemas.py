from pydantic import BaseModel


class CronJob(BaseModel):
    index: int
    raw: str
    schedule: str
    command: str
    comment: str = ""


class AddCronRequest(BaseModel):
    schedule: str
    command: str


class CronListResponse(BaseModel):
    jobs: list[CronJob]
    raw_header: str = ""
