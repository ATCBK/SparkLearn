import json
from collections.abc import AsyncGenerator


def sse_event(event_type: str, payload: dict) -> str:
    return f"data: {json.dumps({'type': event_type, 'payload': payload}, ensure_ascii=False)}\n\n"


async def sse_wrap(generator: AsyncGenerator[tuple[str, dict], None]):
    async for event_type, payload in generator:
        yield sse_event(event_type, payload)

