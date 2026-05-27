import json
from pathlib import Path
from typing import Any

from .config import settings
from .db import now_iso


def _user_dir(user_id: str) -> Path:
    base = settings.data_dir / "users" / user_id
    base.mkdir(parents=True, exist_ok=True)
    return base


def read_json(user_id: str, filename: str, default: Any) -> Any:
    path = _user_dir(user_id) / filename
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(user_id: str, filename: str, payload: Any) -> None:
    path = _user_dir(user_id) / filename
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def append_jsonl(user_id: str, filename: str, record: dict[str, Any]) -> None:
    path = _user_dir(user_id) / filename
    line = json.dumps({"ts": now_iso(), **record}, ensure_ascii=False)
    with path.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
