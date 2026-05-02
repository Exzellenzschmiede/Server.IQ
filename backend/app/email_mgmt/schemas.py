from pydantic import BaseModel


class MailStatus(BaseModel):
    postfix_installed: bool
    dovecot_installed: bool
    postfix_running: bool
    dovecot_running: bool


class Mailbox(BaseModel):
    email: str
    domain: str
    local_part: str


class MailboxCreate(BaseModel):
    email: str
    password: str


class MailAlias(BaseModel):
    source: str
    destination: str


class MailQueueItem(BaseModel):
    queue_id: str
    size: str
    arrival_time: str
    sender: str
    recipients: list[str]
    status: str
