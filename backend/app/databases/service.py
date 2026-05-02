import re
import subprocess

import asyncpg

from app.models import DBConnection


async def pg_list_databases(conn: DBConnection) -> list[dict]:
    c = await asyncpg.connect(host=conn.host, port=conn.port, user=conn.username,
                               password=conn.password, database="postgres", timeout=10)
    try:
        rows = await c.fetch(
            "SELECT datname, pg_database_size(datname) AS size, "
            "pg_catalog.pg_get_userbyid(datdba) AS owner "
            "FROM pg_database WHERE datistemplate = false ORDER BY datname"
        )
        return [{"name": r["datname"], "size_bytes": r["size"], "owner": r["owner"]} for r in rows]
    finally:
        await c.close()


async def pg_list_tables(conn: DBConnection, database: str) -> list[dict]:
    c = await asyncpg.connect(host=conn.host, port=conn.port, user=conn.username,
                               password=conn.password, database=database, timeout=10)
    try:
        rows = await c.fetch(
            "SELECT relname AS name, n_live_tup AS row_estimate, "
            "pg_total_relation_size(c.oid) AS size_bytes "
            "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "JOIN pg_stat_user_tables s ON s.relname = c.relname "
            "WHERE n.nspname = 'public' ORDER BY relname"
        )
        return [{"name": r["name"], "row_estimate": r["row_estimate"], "size_bytes": r["size_bytes"]} for r in rows]
    finally:
        await c.close()


async def pg_list_users(conn: DBConnection) -> list[dict]:
    c = await asyncpg.connect(host=conn.host, port=conn.port, user=conn.username,
                               password=conn.password, database="postgres", timeout=10)
    try:
        rows = await c.fetch("SELECT usename, usesuper FROM pg_user ORDER BY usename")
        return [{"username": r["usename"], "superuser": r["usesuper"]} for r in rows]
    finally:
        await c.close()


async def pg_create_database(conn: DBConnection, name: str) -> None:
    # CREATE DATABASE cannot run in a transaction — use autocommit via asyncpg
    c = await asyncpg.connect(host=conn.host, port=conn.port, user=conn.username,
                               password=conn.password, database="postgres", timeout=10)
    try:
        await c.execute(f'CREATE DATABASE "{name}"')
    finally:
        await c.close()


async def pg_drop_database(conn: DBConnection, name: str) -> None:
    c = await asyncpg.connect(host=conn.host, port=conn.port, user=conn.username,
                               password=conn.password, database="postgres", timeout=10)
    try:
        await c.execute(
            f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", name
        )
        await c.execute(f'DROP DATABASE "{name}"')
    finally:
        await c.close()


async def pg_create_user(conn: DBConnection, username: str, password: str) -> None:
    c = await asyncpg.connect(host=conn.host, port=conn.port, user=conn.username,
                               password=conn.password, database="postgres", timeout=10)
    try:
        await c.execute(f"CREATE USER \"{username}\" WITH PASSWORD $1", password)
    finally:
        await c.close()


async def pg_drop_user(conn: DBConnection, username: str) -> None:
    c = await asyncpg.connect(host=conn.host, port=conn.port, user=conn.username,
                               password=conn.password, database="postgres", timeout=10)
    try:
        await c.execute(f'DROP USER "{username}"')
    finally:
        await c.close()


async def pg_grant(conn: DBConnection, username: str, database: str) -> None:
    c = await asyncpg.connect(host=conn.host, port=conn.port, user=conn.username,
                               password=conn.password, database="postgres", timeout=10)
    try:
        await c.execute(f'GRANT ALL PRIVILEGES ON DATABASE "{database}" TO "{username}"')
    finally:
        await c.close()


async def pg_query(conn: DBConnection, sql: str, database: str | None) -> dict:
    db = database or "postgres"
    c = await asyncpg.connect(host=conn.host, port=conn.port, user=conn.username,
                               password=conn.password, database=db, timeout=10)
    try:
        rows = await c.fetch(sql)
        if not rows:
            return {"columns": [], "rows": [], "rowcount": 0, "error": None}
        columns = list(rows[0].keys())
        data = [[str(v) if v is not None else None for v in row.values()] for row in rows[:500]]
        return {"columns": columns, "rows": data, "rowcount": len(data), "error": None}
    except Exception as exc:
        return {"columns": [], "rows": [], "rowcount": 0, "error": str(exc)}
    finally:
        await c.close()


# ── MySQL via CLI ──────────────────────────────────────────────────────────────

def _mysql_run(conn: DBConnection, sql: str, database: str = "") -> tuple[bool, str]:
    cmd = ["mysql", f"-h{conn.host}", f"-P{conn.port}", f"-u{conn.username}",
           f"-p{conn.password}", "--batch", "--silent", "-e", sql]
    if database:
        cmd.append(database)
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return r.returncode == 0, r.stdout if r.returncode == 0 else r.stderr


def mysql_list_databases(conn: DBConnection) -> list[dict]:
    ok, out = _mysql_run(conn, "SHOW DATABASES;")
    if not ok:
        raise RuntimeError(out)
    return [{"name": line.strip(), "size_bytes": None, "owner": None}
            for line in out.splitlines() if line.strip() not in ("Database", "information_schema", "performance_schema", "sys")]


def mysql_list_tables(conn: DBConnection, database: str) -> list[dict]:
    ok, out = _mysql_run(conn, f"SHOW TABLES FROM `{database}`;")
    if not ok:
        raise RuntimeError(out)
    return [{"name": line.strip(), "row_estimate": None, "size_bytes": None}
            for line in out.splitlines()[1:] if line.strip()]


def mysql_create_database(conn: DBConnection, name: str) -> None:
    ok, out = _mysql_run(conn, f"CREATE DATABASE `{name}`;")
    if not ok:
        raise RuntimeError(out)


def mysql_drop_database(conn: DBConnection, name: str) -> None:
    ok, out = _mysql_run(conn, f"DROP DATABASE `{name}`;")
    if not ok:
        raise RuntimeError(out)


def mysql_query(conn: DBConnection, sql: str, database: str | None) -> dict:
    ok, out = _mysql_run(conn, sql, database or "")
    if not ok:
        return {"columns": [], "rows": [], "rowcount": 0, "error": out}
    lines = [l for l in out.splitlines() if l.strip()]
    if not lines:
        return {"columns": [], "rows": [], "rowcount": 0, "error": None}
    columns = lines[0].split("\t")
    rows = [line.split("\t") for line in lines[1:]]
    return {"columns": columns, "rows": rows[:500], "rowcount": len(rows), "error": None}


def _is_valid_identifier(name: str) -> bool:
    return bool(re.match(r"^[a-zA-Z0-9_]{1,64}$", name))
