"""Code execution endpoints for interactive code exercises."""

import asyncio
import json
import subprocess
import sys
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

TIMEOUT_SECONDS = 5
MAX_OUTPUT_BYTES = 10 * 1024  # 10KB


class CodeRunRequest(BaseModel):
    code: str
    language: str = "python"


class TestCase(BaseModel):
    name: str
    input: str
    expected: str


class CodeTestRequest(BaseModel):
    code: str
    language: str = "python"
    test_cases: list[TestCase]


def _get_python_executable() -> str:
    return sys.executable or "python"


def _run_python_code_sync(code: str, timeout: float = TIMEOUT_SECONDS) -> dict[str, Any]:
    """Run Python code in a subprocess and capture output (sync, for run_in_executor)."""
    try:
        result = subprocess.run(
            [_get_python_executable(), "-c", code],
            capture_output=True,
            timeout=timeout,
            text=True,
        )
        stdout = result.stdout[:MAX_OUTPUT_BYTES] if result.stdout else ""
        stderr = result.stderr[:MAX_OUTPUT_BYTES] if result.stderr else ""
        return {
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": result.returncode or 0,
            "timed_out": False,
        }
    except subprocess.TimeoutExpired:
        return {
            "stdout": "",
            "stderr": "",
            "exit_code": -1,
            "timed_out": True,
        }


async def _run_python_code(code: str, timeout: float = TIMEOUT_SECONDS) -> dict[str, Any]:
    """Run Python code in a thread executor to avoid blocking the event loop."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _run_python_code_sync, code, timeout)


@router.post("/api/code/run")
async def run_code(req: CodeRunRequest):
    """Execute user code and return stdout/stderr."""
    if req.language.lower() not in ("python", "py"):
        raise HTTPException(status_code=400, detail="目前仅支持 Python 代码运行")

    code = req.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="代码不能为空")

    result = await _run_python_code(code)
    return result


@router.post("/api/code/run-tests")
async def run_tests(req: CodeTestRequest):
    """Execute user code against test cases and return results."""
    if req.language.lower() not in ("python", "py"):
        raise HTTPException(status_code=400, detail="目前仅支持 Python 代码运行")

    code = req.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="代码不能为空")

    # Build a test harness script that runs user code + test assertions
    test_script_parts = [
        "import json, sys, io",
        "",
        "# User code",
        code,
        "",
        "# Test harness",
        "_results = []",
        "_original_stdout = sys.stdout",
        "sys.stdout = io.StringIO()",
    ]

    for i, tc in enumerate(req.test_cases):
        # Escape the expected value for embedding in Python
        expected_repr = repr(tc.expected)
        test_name = tc.name.replace('"', '\\"').replace("'", "\\'")
        test_script_parts.extend([
            f"try:",
            f"    _actual = repr({tc.input})",
            f"    _results.append({{'name': '{test_name}', 'passed': _actual == {expected_repr}, 'expected': {expected_repr}, 'actual': _actual}})",
            f"except Exception as e:",
            f"    _results.append({{'name': '{test_name}', 'passed': False, 'expected': {expected_repr}, 'actual': str(e)}})",
        ])

    test_script_parts.extend([
        "",
        "sys.stdout = _original_stdout",
        "print(json.dumps(_results))",
    ])

    test_script = "\n".join(test_script_parts)
    result = await _run_python_code(test_script)

    # Parse test results from stdout
    results = []
    stdout = result["stdout"].strip()
    if stdout:
        # Find the JSON array in output (last line that looks like JSON)
        for line in reversed(stdout.split("\n")):
            line = line.strip()
            if line.startswith("["):
                try:
                    results = json.loads(line)
                    break
                except json.JSONDecodeError:
                    pass

    return {
        "results": results,
        "stdout": stdout,
        "stderr": result["stderr"],
        "timed_out": result["timed_out"],
        "exit_code": result["exit_code"],
    }
