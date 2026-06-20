import asyncio
import concurrent.futures
import json
import os
import sqlite3
import subprocess
import sys
import time
import uuid
import warnings
from typing import Any

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..config import settings
from ..db import execute, fetch_all, fetch_one, now_iso
from ..schemas import fail, ok

# 部分公开 MCP 服务使用自签名证书，屏蔽 SSL 警告
warnings.filterwarnings("ignore", message=".*SSL.*", category=UserWarning)

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
    def __init__(self, command: str, args: list[str], env: dict[str, str], startup_timeout_ms: int, tool_timeout_ms: int, use_framing: bool = True):
        self.command = command
        self.args = args
        self.env = env
        self.startup_timeout = startup_timeout_ms / 1000
        self.tool_timeout = tool_timeout_ms / 1000
        self.proc: asyncio.subprocess.Process | subprocess.Popen[bytes] | None = None
        self._next_id = 1
        self._is_win32 = sys.platform == "win32"
        self._use_framing = use_framing
        # Windows 上用线程池 + 同步 subprocess 绕过 ProactorEventLoop 管道问题
        self._win32_executor: concurrent.futures.ThreadPoolExecutor | None = None

    async def __aenter__(self):
        await self._start_process()
        await self.initialize()
        return self

    async def _start_process(self) -> None:
        process_env = {**os.environ, **self.env}
        if self._is_win32:
            if self._win32_executor is None:
                self._win32_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            cmd_parts = [self.command] + list(self.args)
            proc_popen = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    self._win32_executor,
                    lambda: subprocess.Popen(
                        cmd_parts,
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.DEVNULL,
                        env=process_env,
                    ),
                ),
                timeout=self.startup_timeout,
            )
            self.proc = proc_popen  # type: ignore[assignment]
        else:
            self.proc = await asyncio.wait_for(
                asyncio.create_subprocess_exec(
                    self.command,
                    *self.args,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.DEVNULL,
                    env=process_env,
                ),
                timeout=self.startup_timeout,
            )

    async def _stop_process(self) -> None:
        if self._is_win32:
            if isinstance(self.proc, subprocess.Popen) and self.proc.returncode is None:
                self.proc.terminate()
                try:
                    await asyncio.wait_for(
                        asyncio.get_event_loop().run_in_executor(None, self.proc.wait),
                        timeout=2,
                    )
                except asyncio.TimeoutError:
                    self.proc.kill()
        else:
            p = self.proc  # type: ignore[union-attr]
            if p and p.returncode is None:
                p.terminate()
                try:
                    await asyncio.wait_for(p.wait(), timeout=2)
                except asyncio.TimeoutError:
                    p.kill()
        self.proc = None

    async def __aexit__(self, exc_type, exc, tb):
        await self._stop_process()
        if self._win32_executor:
            self._win32_executor.shutdown(wait=False)
            self._win32_executor = None

    async def _send(self, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        if self._use_framing:
            data = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii") + body
        else:
            data = body + b"\n"
        if self._is_win32 and isinstance(self.proc, subprocess.Popen) and self.proc.stdin:
            self.proc.stdin.write(data)
            self.proc.stdin.flush()
        elif not self._is_win32 and hasattr(self.proc, 'stdin'):
            p = self.proc  # type: ignore[union-attr]
            if p and p.stdin:
                p.stdin.write(data)
                await p.stdin.drain()
        else:
            raise RuntimeError("mcp process not started")

    async def _read_message(self) -> dict[str, Any]:
        if self._is_win32 and isinstance(self.proc, subprocess.Popen):
            read_future = asyncio.get_event_loop().run_in_executor(
                None, self._win32_read_message, self.proc, self._use_framing, self.tool_timeout,
            )
            return await asyncio.wait_for(read_future, timeout=self.tool_timeout)
        p = self.proc  # type: ignore[union-attr]
        if not p or not p.stdout:
            raise RuntimeError("mcp process not started")
        if self._use_framing:
            headers: dict[str, str] = {}
            while True:
                line = await asyncio.wait_for(p.stdout.readline(), timeout=self.tool_timeout)
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
            body = await asyncio.wait_for(p.stdout.readexactly(length), timeout=self.tool_timeout)
        else:
            line = await asyncio.wait_for(p.stdout.readline(), timeout=self.tool_timeout)
            if not line:
                raise RuntimeError("mcp connection closed")
            body = line
        return json.loads(body.decode("utf-8", errors="ignore"))

    @staticmethod
    def _win32_read_message(proc: subprocess.Popen[bytes], use_framing: bool, _timeout_sec: float) -> dict[str, Any]:
        """Windows 上用同步 subprocess.Popen 读取 MCP 消息（在线程池中执行）。"""
        if not proc.stdout:
            raise RuntimeError("mcp process not started")
        if use_framing:
            headers: dict[str, str] = {}
            while True:
                line = proc.stdout.readline()
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
            body = proc.stdout.read(length)
        else:
            line = proc.stdout.readline()
            if not line:
                raise RuntimeError("mcp connection closed")
            body = line
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
        """初始化 MCP 连接，自动降级无帧头模式兼容非标准服务。"""
        try:
            await self.request(
                "initialize",
                {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "sparklearn", "version": "1.0.0"},
                },
            )
            await self.notify("notifications/initialized", {})
        except Exception:
            if self._use_framing:
                self._use_framing = False
                await self._stop_process()
                await self._start_process()
                await self.request(
                    "initialize",
                    {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {},
                        "clientInfo": {"name": "sparklearn", "version": "1.0.0"},
                    },
                )
                await self.notify("notifications/initialized", {})
            else:
                raise


class _McpHttpClient:
    """HTTP 远程 MCP 客户端 —— 通过 HTTP POST JSON-RPC 与远程 MCP 服务通信。"""

    def __init__(self, endpoint: str, tool_timeout_ms: int):
        self.endpoint = endpoint.rstrip("/")
        self.tool_timeout = tool_timeout_ms / 1000
        self._next_id = 1
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self):
        self._client = httpx.AsyncClient(timeout=self.tool_timeout, verify=False)
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not self._client:
            raise RuntimeError("http client not initialized")
        resp = await self._client.post(
            self.endpoint,
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        body = resp.json()
        if "error" in body:
            raise RuntimeError(str(body["error"]))
        return body.get("result", {})

    async def request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        req_id = self._next_id
        self._next_id += 1
        return await self._post(
            {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params or {}}
        )

    async def notify(self, method: str, params: dict[str, Any] | None = None) -> None:
        await self._post({"jsonrpc": "2.0", "method": method, "params": params or {}})

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
    timeout = int(service["tool_timeout_ms"] or 30000)
    startup_timeout = int(service["startup_timeout_ms"] or 60000)

    if transport == "http":
        endpoint = str(service["endpoint"] or "").strip()
        if not endpoint:
            raise RuntimeError("endpoint is required for http transport")
        start = time.perf_counter()
        async with _McpHttpClient(endpoint, timeout) as client:
            tools_result = await client.request("tools/list", {})
            tools = tools_result.get("tools", [])
            duration_ms = int((time.perf_counter() - start) * 1000)
            return {"status": "online", "duration_ms": duration_ms, "tool_count": len(tools)}

    if transport == "stdio":
        command = str(service["command"] or "").strip()
        args = _json_loads_list(service["args_json"])
        env = _json_loads_dict(service["env_json"])
        if not command:
            raise RuntimeError("stdio command is required")
        start = time.perf_counter()
        async with _McpStdioClient(command, args, env, startup_timeout, timeout) as client:
            tools_result = await client.request("tools/list", {})
            tools = tools_result.get("tools", [])
            duration_ms = int((time.perf_counter() - start) * 1000)
            return {"status": "online", "duration_ms": duration_ms, "tool_count": len(tools)}

    raise RuntimeError(f"unsupported transport: {transport}")


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


def _validate_mcp_payload(payload: McpServicePayload) -> str | None:
    if payload.transport == "http" and not payload.endpoint.strip():
        return "endpoint is required for http transport"
    if payload.transport == "stdio" and not payload.command.strip():
        return "command is required for stdio transport"
    return None


async def _update_service_impl(service_id: str, payload: McpServicePayload):
    row = _get_service_or_none(service_id)
    if not row:
        return fail("service not found")
    if row["source"] != "user":
        return fail("system service cannot be edited")
    payload_error = _validate_mcp_payload(payload)
    if payload_error:
        return fail(payload_error)

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


@router.put("/services/{service_id}")
async def update_service(service_id: str, payload: McpServicePayload):
    return await _update_service_impl(service_id, payload)


@router.post("/services/{service_id}")
async def update_service_compat(service_id: str, payload: McpServicePayload):
    # Some clients only issue POST for form-style updates; keep this path compatible.
    return await _update_service_impl(service_id, payload)


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
        result = await _mcp_request(row, "tools/list", {})
        return ok({"items": result.get("tools", [])})
    except Exception as exc:
        return fail(str(exc))


async def _mcp_request(service: sqlite3.Row, method: str, params: dict[str, Any]) -> dict[str, Any]:
    """统一的 MCP 请求入口，根据 transport 自动选择客户端。"""
    transport = service["transport"]
    timeout = int(service["tool_timeout_ms"] or 30000)
    startup_timeout = int(service["startup_timeout_ms"] or 60000)

    if transport == "http":
        endpoint = str(service["endpoint"] or "").strip()
        if not endpoint:
            raise RuntimeError("endpoint is required for http transport")
        async with _McpHttpClient(endpoint, timeout) as client:
            return await client.request(method, params)

    if transport == "stdio":
        command = str(service["command"] or "").strip()
        args = _json_loads_list(service["args_json"])
        env = _json_loads_dict(service["env_json"])
        if not command:
            raise RuntimeError("stdio command is required")
        async with _McpStdioClient(command, args, env, startup_timeout, timeout) as client:
            return await client.request(method, params)

    raise RuntimeError(f"unsupported transport: {transport}")


@router.post("/services/{service_id}/call")
async def call_tool(service_id: str, payload: McpToolCallPayload):
    row = _get_service_or_none(service_id)
    if not row:
        return fail("service not found")
    try:
        result = await _mcp_request(
            row,
            "tools/call",
            {"name": payload.tool_name, "arguments": payload.args},
        )
        return ok(result)
    except Exception as exc:
        return fail(str(exc))
