from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor


def test_update_json_preserves_concurrent_appends(client):
    from app.storage import read_json, update_json

    user_id = "storage_concurrent_user"

    def append_value(value: int) -> None:
        def mutate(items: list[int]) -> list[int]:
            items.append(value)
            return items

        update_json(user_id, "items.json", [], mutate)

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(append_value, range(40)))

    assert sorted(read_json(user_id, "items.json", [])) == list(range(40))
