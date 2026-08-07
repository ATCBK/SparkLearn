import json
import threading
import uuid
from pathlib import Path
from typing import Any, Callable, TypeVar

from .config import settings
from .db import now_iso

T = TypeVar("T")
_path_locks_guard = threading.Lock()
_path_locks: dict[str, threading.RLock] = {}


def _user_dir(user_id: str) -> Path:
    base = settings.data_dir / "users" / user_id
    base.mkdir(parents=True, exist_ok=True)
    return base


def _json_path(user_id: str, filename: str) -> Path:
    return _user_dir(user_id) / filename


def _path_lock(path: Path) -> threading.RLock:
    key = str(path.resolve())
    with _path_locks_guard:
        lock = _path_locks.get(key)
        if lock is None:
            lock = threading.RLock()
            _path_locks[key] = lock
        return lock


def _read_json_path(path: Path, default: T) -> T:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _write_json_path(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp_path.replace(path)


def read_json(user_id: str, filename: str, default: Any) -> Any:
    path = _json_path(user_id, filename)
    with _path_lock(path):
        return _read_json_path(path, default)


def write_json(user_id: str, filename: str, payload: Any) -> None:
    path = _json_path(user_id, filename)
    with _path_lock(path):
        _write_json_path(path, payload)


def update_json(user_id: str, filename: str, default: T, mutator: Callable[[T], T]) -> T:
    path = _json_path(user_id, filename)
    with _path_lock(path):
        current = _read_json_path(path, default)
        updated = mutator(current)
        _write_json_path(path, updated)
        return updated


def append_jsonl(user_id: str, filename: str, record: dict[str, Any]) -> None:
    path = _json_path(user_id, filename)
    line = json.dumps({"ts": now_iso(), **record}, ensure_ascii=False)
    with _path_lock(path):
        with path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
