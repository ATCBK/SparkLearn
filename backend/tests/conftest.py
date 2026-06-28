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
async def client(tmp_path, monkeypatch):
    # Keep tests deterministic and offline.
    monkeypatch.setattr(settings, "data_dir", tmp_path / "data")
    monkeypatch.setattr(settings, "db_path", tmp_path / "data" / "db" / "sparklearn-test.db")
    monkeypatch.setattr(settings, "spark_default_model", "lite")
    monkeypatch.setattr(settings, "spark_use_bridge", False)
    monkeypatch.setattr(settings, "spark_app_id", "")
    monkeypatch.setattr(settings, "spark_api_key", "")
    monkeypatch.setattr(settings, "spark_api_secret", "")
    monkeypatch.setattr(settings, "deepseek_api_key", "")
    monkeypatch.setattr(settings, "dashscope_api_key", "")
    monkeypatch.setattr(settings, "video_ai_api_key", "")
    monkeypatch.setattr(settings, "tavily_api_key", "")
    init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
