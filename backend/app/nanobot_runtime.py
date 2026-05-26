from __future__ import annotations

import asyncio
import os
import socket
import subprocess
from dataclasses import dataclass
from pathlib import Path

import httpx

from .config import settings


@dataclass
class NanobotRuntimeHandle:
    process: subprocess.Popen | None
    started_by_app: bool
    stdout_file: object | None = None
    stderr_file: object | None = None


def _is_port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.5):
            return True
    except OSError:
        return False


async def _wait_for_nanobot_health(timeout_sec: float) -> bool:
    health_url = f"{settings.nanobot_api_base_url.rstrip('/')}/health"
    deadline = asyncio.get_running_loop().time() + timeout_sec
    while asyncio.get_running_loop().time() < deadline:
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(health_url)
                if response.status_code == 200:
                    return True
        except Exception:
            pass
        await asyncio.sleep(1)
    return False


async def ensure_nanobot_runtime() -> NanobotRuntimeHandle:
    if not settings.nanobot_pet_enabled or not settings.nanobot_auto_start:
        return NanobotRuntimeHandle(process=None, started_by_app=False)

    if _is_port_open(settings.nanobot_api_host, settings.nanobot_api_port):
        healthy = await _wait_for_nanobot_health(timeout_sec=5)
        if healthy:
            return NanobotRuntimeHandle(process=None, started_by_app=False)
        raise RuntimeError(
            f"port {settings.nanobot_api_port} is already in use, but nanobot health check failed"
        )

    project_dir = Path(settings.nanobot_project_dir).expanduser().resolve()
    if not project_dir.exists():
        raise RuntimeError(f"nanobot project dir not found: {project_dir}")
    python_exe = Path(settings.nanobot_python_exe).expanduser().resolve() if settings.nanobot_python_exe else None
    if not python_exe or not python_exe.exists():
        raise RuntimeError(f"nanobot python executable not found: {python_exe}")

    env = os.environ.copy()
    existing_pythonpath = env.get("PYTHONPATH", "")
    project_path = str(project_dir)
    env["PYTHONPATH"] = project_path if not existing_pythonpath else f"{project_path}{os.pathsep}{existing_pythonpath}"

    command = [
        str(python_exe),
        "-m",
        "nanobot",
        "serve",
        "--host",
        settings.nanobot_api_host,
        "--port",
        str(settings.nanobot_api_port),
    ]

    if settings.nanobot_config_path:
        command.extend(["--config", str(Path(settings.nanobot_config_path).expanduser().resolve())])
    if settings.nanobot_workspace:
        command.extend(["--workspace", str(Path(settings.nanobot_workspace).expanduser().resolve())])

    logs_dir = settings.data_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    stdout_path = logs_dir / "nanobot.stdout.log"
    stderr_path = logs_dir / "nanobot.stderr.log"

    stdout_file = open(stdout_path, "ab")
    stderr_file = open(stderr_path, "ab")
    try:
        process = subprocess.Popen(
            command,
            cwd=str(project_dir),
            env=env,
            stdout=stdout_file,
            stderr=stderr_file,
        )
    except Exception:
        stdout_file.close()
        stderr_file.close()
        raise

    healthy = await _wait_for_nanobot_health(timeout_sec=30)
    if not healthy:
        if process.poll() is None:
            process.terminate()
            try:
                await asyncio.to_thread(process.wait, 5)
            except subprocess.TimeoutExpired:
                process.kill()
        stdout_file.close()
        stderr_file.close()
        raise RuntimeError("nanobot failed to become healthy within 30s")

    return NanobotRuntimeHandle(
        process=process,
        started_by_app=True,
        stdout_file=stdout_file,
        stderr_file=stderr_file,
    )


async def stop_nanobot_runtime(handle: NanobotRuntimeHandle | None) -> None:
    if not handle or not handle.started_by_app or not handle.process:
        return
    process = handle.process
    if process.poll() is not None:
        return
    process.terminate()
    try:
        await asyncio.to_thread(process.wait, 5)
    except subprocess.TimeoutExpired:
        process.kill()
    finally:
        if handle.stdout_file:
            handle.stdout_file.close()
        if handle.stderr_file:
            handle.stderr_file.close()
