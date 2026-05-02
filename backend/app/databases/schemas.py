from pydantic import BaseModel


class DBConnectionCreate(BaseModel):
    name: str
    db_type: str   # postgresql | mysql
    host: str = "127.0.0.1"
    port: int
    username: str
    password: str = ""


class DBConnectionOut(BaseModel):
    id: int
    name: str
    db_type: str
    host: str
    port: int
    username: str

    model_config = {"from_attributes": True}


class DatabaseInfo(BaseModel):
    name: str
    size_bytes: int | None = None
    owner: str | None = None


class TableInfo(BaseModel):
    name: str
    row_estimate: int | None = None
    size_bytes: int | None = None


class DBUserInfo(BaseModel):
    username: str
    superuser: bool = False


class QueryResult(BaseModel):
    columns: list[str]
    rows: list[list]
    rowcount: int
    error: str | None = None


class QueryRequest(BaseModel):
    sql: str
    database: str | None = None


class CreateDatabaseRequest(BaseModel):
    name: str


class CreateUserRequest(BaseModel):
    username: str
    password: str


class GrantRequest(BaseModel):
    username: str
    database: str
