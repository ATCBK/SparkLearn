import asyncio
import json
import os
import sqlite3
import time
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..config import settings
from ..db import execute, fetch_all, fetch_one, now_iso
from ..schemas import fail, ok

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


class McpServicePayload(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = ""
    transport: str = Field(pattern="^(stdio|http)$")
    endpoint: str = ""
    command: str = ""
    args_json: list[str] = Field(default_factory=list)
    env_json: dict[str, str] = Field(default_factory=dict)
    enabled: bool = False
    startup_timeout_ms: int = 60000
    tool_timeout_ms: int = 30000
    long_task_timeout_ms: int = 120000


class McpTogglePayload(BaseModel):
    enabled: bool


class McpToolCallPayload(BaseModel):
    tool_name: str
    args: dict[str, Any] = Field(default_factory=dict)


class _McpStdioClient:
    def __init__(self, command: str, args: list[str], env: dict[str, str], startup_timeout_ms: int, tool_timeout_ms: int):
        self.command = command
        self.args = args
        self.env = env
        self.startup_timeout = startup_timeout_ms / 1000
        self.tool_timeout = tool_timeout_ms / 1000
        self.proc: asyncio.subprocess.Process | None = None
        self._next_id = 1

    async def __aenter__(self):
        process_env = {**os.environ, **self.env}
        self.proc = await asyncio.wait_for(
            asyncio.create_subprocess_exec(
                self.command,
                *self.args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=process_env,
            ),
            timeout=self.startup_timeout,
        )
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if self.proc and self.proc.returncode is None:
            self.proc.terminate()
            try:
                await asyncio.wait_for(self.proc.wait(), timeout=2)
            except asyncio.TimeoutError:
                self.proc.kill()

    async def _send(self, payload: dict[str, Any]) -> None:
        if not self.proc or not self.proc.stdin:
            raise RuntimeError("mcp process not started")
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        header = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
        self.proc.stdin.write(header + body)
        await self.proc.stdin.drain()

    async def _read_message(self) -> dict[str, Any]:
        if not self.proc or not self.proc.stdout:
            raise RuntimeError("mcp process not started")

        headers: dict[str, str] = {}
        while True:
            line = await asyncio.wait_for(self.proc.stdout.readline(), timeout=self.tool_timeout)
            if not line:
                raise RuntimeError("mcp connection closed")
            stripped = line.decode("utf-8", errors="ignore").strip()
            if not stripped:
                break
            if ":" in stripped:
                key, value = stripped.split(":", 1)
                headers[key.strip().lower()] = value.strip()

        length = int(headers.get("content-length", "0"))
        if length <= 0:
            raise RuntimeError("invalid mcp frame")
        body = await asyncio.wait_for(self.proc.stdout.readexactly(length), timeout=self.tool_timeout)
        return json.loads(body.decode("utf-8", errors="ignore"))

    async def request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        req_id = self._next_id
        self._next_id += 1
        await self._send({"jsonrpc": "2.0", "id": req_id, "method": method, "params": params or {}})
        while True:
            msg = await self._read_message()
            if msg.get("id") == req_id:
                if "error" in msg:
                    raise RuntimeError(str(msg["error"]))
                return msg.get("result", {})

    async def notify(self, method: str, params: dict[str, Any] | None = None) -> None:
        await self._send({"jsonrpc": "2.0", "method": method, "params": params or {}})

    async def initialize(self) -> None:
        await self.request(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "sparklearn", "version": "1.0.0"},
            },
        )
        await self.notify("notifications/initialized", {})


async def _mcp_test(service: sqlite3.Row) -> dict[str, Any]:
    transport = service["transport"]
    if transport == "stdio":
        command = str(service["command"] or "").strip()
        args = _json_loads_list(service["args_json"])
        env = _json_loads_dict(service["env_json"])
        timeout = int(service["tool_timeout_ms"] or 30000)
        startup_timeout = int(service["startup_timeout_ms"] or 60000)
        if not command:
            raise RuntimeError("stdio command is required")
        start = time.perf_counter()
        async with _McpStdioClient(command, args, env, startup_timeout, timeout) as client:
            tools_result = await client.request("tools/list", {})
            tools = tools_result.get("tools", [])
            duration_ms = int((time.perf_counter() - start) * 1000)
            return {"status": "online", "duration_ms": duration_ms, "tool_count": len(tools)}

    raise RuntimeError("only stdio transport is supported in demo")


def _json_loads_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
        if isinstance(value, list):
            return [str(x) for x in value]
    except Exception:
        pass
    return []


def _json_loads_dict(raw: str | None) -> dict[str, str]:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
        if isinstance(value, dict):
            return {str(k): str(v) for k, v in value.items()}
    except Exception:
        pass
    return {}


def _to_resp(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "source": row["source"],
        "transport": row["transport"],
        "endpoint": row["endpoint"],
        "command": row["command"],
        "args_json": _json_loads_list(row["args_json"]),
        "env_json": _json_loads_dict(row["env_json"]),
        "enabled": bool(row["enabled"]),
        "last_status": row["last_status"],
        "last_error": row["last_error"],
        "last_tested_at": row["last_tested_at"],
        "startup_timeout_ms": row["startup_timeout_ms"],
        "tool_timeout_ms": row["tool_timeout_ms"],
        "long_task_timeout_ms": row["long_task_timeout_ms"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _get_service_or_none(service_id: str):
    return fetch_one(
        "SELECT * FROM mcp_services WHERE id = ? AND owner_id = ?",
        (service_id, settings.single_user_id),
    )


@router.get("/services")
async def list_services(scope: str = "all"):
    if scope not in {"all", "system", "user"}:
        return fail("invalid scope")
    if scope == "all":
        rows = fetch_all(
            "SELECT * FROM mcp_services WHERE owner_id = ? ORDER BY updated_at DESC",
            (settings.single_user_id,),
        )
    else:
        rows = fetch_all(
            "SELECT * FROM mcp_services WHERE owner_id = ? AND source = ? ORDER BY updated_at DESC",
            (settings.single_user_id, scope),
        )
    return ok({"items": [_to_resp(row) for row in rows]})


@router.post("/services")
async def create_service(payload: McpServicePayload):
    if payload.transport == "http" and not payload.endpoint.strip():
        return fail("endpoint is required for http transport")
    if payload.transport == "stdio" and not payload.command.strip():
        return fail("command is required for stdio transport")

    service_id = f"svc_{uuid.uuid4().hex[:12]}"
    ts = now_iso()
    execute(
        """
        INSERT INTO mcp_services(
          id, owner_id, name, description, source, transport, endpoint, command,
          args_json, env_json, enabled, last_status, last_error, last_tested_at,
          startup_timeout_ms, tool_timeout_ms, long_task_timeout_ms, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?, ?, ?, 'unknown', '', '', ?, ?, ?, ?, ?)
        """,
        (
            service_id,
            settings.single_user_id,
            payload.name.strip(),
            payload.description.strip(),
            payload.transport,
            payload.endpoint.strip(),
            payload.command.strip(),
            json.dumps(payload.args_json, ensure_ascii=False),
            json.dumps(payload.env_json, ensure_ascii=False),
            1 if payload.enabled else 0,
            payload.startup_timeout_ms,
            payload.tool_timeout_ms,
            payload.long_task_timeout_ms,
            ts,
            ts,
        ),
    )
    row = _get_service_or_none(service_id)
    return ok(_to_resp(row))


@router.put("/services/{service_id}")
async def update_service(service_id: str, payload: McpServicePayload):
    row = _get_service_or_none(service_id)
    if not row:
        return fail("service not found")
    if row["source"] != "user":
        return fail("system service cannot be edited")
    if payload.transport == "http" and not payload.endpoint.strip():
        return fail("endpoint is required for http transport")
    if payload.transport == "stdio" and not payload.command.strip():
        return fail("command is required for stdio transport")

    execute(
        """
        UPDATE mcp_services
        SET name = ?, description = ?, transport = ?, endpoint = ?, command = ?,
            args_json = ?, env_json = ?, enabled = ?, startup_timeout_ms = ?,
            tool_timeout_ms = ?, long_task_timeout_ms = ?, updated_at = ?
        WHERE id = ? AND owner_id = ?
        """,
        (
            payload.name.strip(),
            payload.description.strip(),
            payload.transport,
            payload.endpoint.strip(),
            payload.command.strip(),
            json.dumps(payload.args_json, ensure_ascii=False),
            json.dumps(payload.env_json, ensure_ascii=False),
            1 if payload.enabled else 0,
            payload.startup_timeout_ms,
            payload.tool_timeout_ms,
            payload.long_task_timeout_ms,
            now_iso(),
            service_id,
            settings.single_user_id,
        ),
    )
    updated = _get_service_or_none(service_id)
    return ok(_to_resp(updated))


@router.delete("/services/{service_id}")
async def delete_service(service_id: str):
    row = _get_service_or_none(service_id)
    if not row:
        return fail("service not found")
    if row["source"] != "user":
        return fail("system service cannot be deleted")
    execute("DELETE FROM mcp_services WHERE id = ? AND owner_id = ?", (service_id, settings.single_user_id))
    return ok({"deleted": True})


@router.post("/services/{service_id}/test")
async def test_service(service_id: str):
    row = _get_service_or_none(service_id)
    if not row:
        return fail("service not found")
    try:
        result = await _mcp_test(row)
        now = now_iso()
        execute(
            """
            UPDATE mcp_services
            SET last_status = 'online', last_error = '', last_tested_at = ?, updated_at = ?
            WHERE id = ? AND owner_id = ?
            """,
            (now, now, service_id, settings.single_user_id),
        )
        return ok({"ok": True, **result, "error": ""})
    except Exception as exc:
        err = str(exc)
        now = now_iso()
        execute(
            """
            UPDATE mcp_services
            SET last_status = 'offline', last_error = ?, last_tested_at = ?, updated_at = ?
            WHERE id = ? AND owner_id = ?
            """,
            (err[:500], now, now, service_id, settings.single_user_id),
        )
        return ok({"ok": False, "status": "offline", "duration_ms": 0, "tool_count": 0, "error": err})


@router.post("/services/{service_id}/toggle")
async def toggle_service(service_id: str, payload: McpTogglePayload):
    row = _get_service_or_none(service_id)
    if not row:
        return fail("service not found")
    if payload.enabled and row["last_status"] != "online":
        try:
            result = await _mcp_test(row)
            now = now_iso()
            execute(
                """
                UPDATE mcp_services
                SET last_status = 'online', last_error = '', last_tested_at = ?, updated_at = ?
                WHERE id = ? AND owner_id = ?
                """,
                (now, now, service_id, settings.single_user_id),
            )
        except Exception as exc:
            err = str(exc)
            now = now_iso()
            execute(
                """
                UPDATE mcp_services
                SET last_status = 'offline', last_error = ?, last_tested_at = ?, updated_at = ?
                WHERE id = ? AND owner_id = ?
                """,
                (err[:500], now, now, service_id, settings.single_user_id),
            )
            return fail(f"enable failed: {err}")
    execute(
        "UPDATE mcp_services SET enabled = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
        (1 if payload.enabled else 0, now_iso(), service_id, settings.single_user_id),
    )
    updated = _get_service_or_none(service_id)
    return ok(_to_resp(updated))


@router.get("/services/{service_id}/tools")
async def get_tools(service_id: str):
    row = _get_service_or_none(service_id)
    if not row:
        return fail("service not found")
    try:
        if row["transport"] != "stdio":
            return fail("only stdio transport is supported in demo")
        async with _McpStdioClient(
            str(row["command"] or ""),
            _json_loads_list(row["args_json"]),
            _json_loads_dict(row["env_json"]),
            int(row["startup_timeout_ms"] or 60000),
            int(row["tool_timeout_ms"] or 30000),
        ) as client:
            result = await client.request("tools/list", {})
            return ok({"items": result.get("tools", [])})
    except Exception as exc:
        return fail(str(exc))


@router.post("/services/{service_id}/call")
async def call_tool(service_id: str, payload: McpToolCallPayload):
    row = _get_service_or_none(service_id)
    if not row:
        return fail("service not found")
    if row["transport"] != "stdio":
        return fail("only stdio transport is supported in demo")

    try:
        async with _McpStdioClient(
            str(row["command"] or ""),
            _json_loads_list(row["args_json"]),
            _json_loads_dict(row["env_json"]),
            int(row["startup_timeout_ms"] or 60000),
            int(row["tool_timeout_ms"] or 30000),
        ) as client:
            result = await client.request(
                "tools/call",
                {"name": payload.tool_name, "arguments": payload.args},
            )
            return ok(result)
    except Exception as exc:
        return fail(str(exc))
