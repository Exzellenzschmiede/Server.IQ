from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models import DBConnection, User

from .schemas import (
    CreateDatabaseRequest,
    CreateUserRequest,
    DBConnectionCreate,
    DBConnectionOut,
    DatabaseInfo,
    DBUserInfo,
    GrantRequest,
    QueryRequest,
    QueryResult,
    TableInfo,
)
from .service import (
    _is_valid_identifier,
    mysql_create_database,
    mysql_drop_database,
    mysql_list_databases,
    mysql_list_tables,
    mysql_query,
    pg_create_database,
    pg_create_user,
    pg_drop_database,
    pg_drop_user,
    pg_grant,
    pg_list_databases,
    pg_list_tables,
    pg_list_users,
    pg_query,
)

router = APIRouter()


async def _get_conn(conn_id: int, db: AsyncSession) -> DBConnection:
    conn = await db.get(DBConnection, conn_id)
    if not conn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Connection not found")
    return conn


# ── Connections ────────────────────────────────────────────────────────────────

@router.get("/connections", response_model=list[DBConnectionOut])
async def list_connections(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DBConnection).order_by(DBConnection.id))
    return result.scalars().all()


@router.post("/connections", response_model=DBConnectionOut, status_code=status.HTTP_201_CREATED)
async def create_connection(body: DBConnectionCreate, _: User = Depends(require_admin),
                            db: AsyncSession = Depends(get_db)):
    conn = DBConnection(**body.model_dump())
    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return conn


@router.delete("/connections/{conn_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(conn_id: int, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    conn = await db.get(DBConnection, conn_id)
    if conn:
        await db.delete(conn)
        await db.commit()


# ── Databases ─────────────────────────────────────────────────────────────────

@router.get("/{conn_id}/databases", response_model=list[DatabaseInfo])
async def list_databases(conn_id: int, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    conn = await _get_conn(conn_id, db)
    try:
        if conn.db_type == "postgresql":
            return await pg_list_databases(conn)
        return mysql_list_databases(conn)
    except Exception as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.post("/{conn_id}/databases", status_code=status.HTTP_201_CREATED)
async def create_database(conn_id: int, body: CreateDatabaseRequest, _: User = Depends(require_admin),
                          db: AsyncSession = Depends(get_db)):
    if not _is_valid_identifier(body.name):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid database name")
    conn = await _get_conn(conn_id, db)
    try:
        if conn.db_type == "postgresql":
            await pg_create_database(conn, body.name)
        else:
            mysql_create_database(conn, body.name)
        return {"name": body.name}
    except Exception as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{conn_id}/databases/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def drop_database(conn_id: int, name: str, _: User = Depends(require_admin),
                        db: AsyncSession = Depends(get_db)):
    conn = await _get_conn(conn_id, db)
    try:
        if conn.db_type == "postgresql":
            await pg_drop_database(conn, name)
        else:
            mysql_drop_database(conn, name)
    except Exception as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{conn_id}/databases/{name}/tables", response_model=list[TableInfo])
async def list_tables(conn_id: int, name: str, _: User = Depends(require_admin),
                      db: AsyncSession = Depends(get_db)):
    conn = await _get_conn(conn_id, db)
    try:
        if conn.db_type == "postgresql":
            return await pg_list_tables(conn, name)
        return mysql_list_tables(conn, name)
    except Exception as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(e))


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/{conn_id}/users", response_model=list[DBUserInfo])
async def list_users(conn_id: int, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    conn = await _get_conn(conn_id, db)
    if conn.db_type != "postgresql":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="User management only available for PostgreSQL")
    try:
        return await pg_list_users(conn)
    except Exception as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.post("/{conn_id}/users", status_code=status.HTTP_201_CREATED)
async def create_user(conn_id: int, body: CreateUserRequest, _: User = Depends(require_admin),
                      db: AsyncSession = Depends(get_db)):
    conn = await _get_conn(conn_id, db)
    if conn.db_type != "postgresql":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="User management only available for PostgreSQL")
    try:
        await pg_create_user(conn, body.username, body.password)
        return {"username": body.username}
    except Exception as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{conn_id}/users/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def drop_user(conn_id: int, username: str, _: User = Depends(require_admin),
                    db: AsyncSession = Depends(get_db)):
    conn = await _get_conn(conn_id, db)
    if conn.db_type != "postgresql":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="User management only available for PostgreSQL")
    try:
        await pg_drop_user(conn, username)
    except Exception as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{conn_id}/grant")
async def grant_privileges(conn_id: int, body: GrantRequest, _: User = Depends(require_admin),
                           db: AsyncSession = Depends(get_db)):
    conn = await _get_conn(conn_id, db)
    if conn.db_type != "postgresql":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Grant only available for PostgreSQL")
    try:
        await pg_grant(conn, body.username, body.database)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── SQL Query ─────────────────────────────────────────────────────────────────

@router.post("/{conn_id}/query", response_model=QueryResult)
async def run_query(conn_id: int, body: QueryRequest, _: User = Depends(require_admin),
                    db: AsyncSession = Depends(get_db)):
    conn = await _get_conn(conn_id, db)
    try:
        if conn.db_type == "postgresql":
            return await pg_query(conn, body.sql, body.database)
        return mysql_query(conn, body.sql, body.database)
    except Exception as e:
        return QueryResult(columns=[], rows=[], rowcount=0, error=str(e))
