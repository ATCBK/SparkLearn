import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.db import init_db
from app.config import settings
from app.main import app


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture()
async def client():
    # Keep tests deterministic and offline.
    settings.spark_app_id = ""
    settings.spark_api_key = ""
    settings.spark_api_secret = ""
    init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
