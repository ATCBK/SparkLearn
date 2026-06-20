import pytest
import httpx

from app.routes import resources as resources_route


@pytest.mark.asyncio
async def test_preview_html_retries_known_document_host_with_insecure_ssl(client, monkeypatch):
    item = {
        "id": "doc-ssl-preview",
        "title": "函数返回值讲义",
        "type": "document",
        "content": "# 本地回退内容\n\n不应该命中这个回退。",
        "source_url": "https://ts.fyshark.com/html_files/document_1781428423394.html",
    }

    class FakeResponse:
        def __init__(self, text: str, content_type: str = "text/html"):
            self.text = text
            self.headers = {"content-type": content_type}

        def raise_for_status(self):
            return None

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            self.verify = kwargs.get("verify", True)

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str):
            if self.verify is False:
                return FakeResponse("<html><body><h1>External doc</h1></body></html>")
            raise httpx.ConnectError(
                "[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: certificate has expired",
            )

    monkeypatch.setattr(resources_route, "_find_resource", lambda resource_id: item)
    monkeypatch.setattr(resources_route.httpx, "AsyncClient", FakeAsyncClient)

    resp = await client.get("/api/resources/doc-ssl-preview/preview/html")

    assert resp.status_code == 200
    assert "External doc" in resp.text
    assert "不应该命中这个回退" not in resp.text


def test_normalize_generated_content_removes_concatenated_source_urls():
    source_url = "https://ts.fyshark.com/html_files/document_1781428423394.html"
    content = (
        "https://ts.fyshark.com/html_files/document_178142842394.html"
        "https://ts.fyshark.com/html_files/document_1781428423394.html"
    )

    normalized = resources_route._normalize_generated_content(content, source_url)

    assert normalized == ""


def test_contentcube_preview_url_is_iframe_embeddable():
    url = "https://preview.contentcube.cn/preview_1781430809752_8pqecz.html"

    assert resources_route._is_iframe_embeddable_url(url) is True


@pytest.mark.asyncio
async def test_preview_html_wraps_contentcube_url_with_iframe(client, monkeypatch):
    item = {
        "id": "contentcube-preview",
        "title": "Python函数讲义",
        "type": "document",
        "content": "# 本地内容",
        "source_url": "https://preview.contentcube.cn/preview_1781430809752_8pqecz.html",
    }

    monkeypatch.setattr(resources_route, "_find_resource", lambda resource_id: item)

    resp = await client.get("/api/resources/contentcube-preview/preview/html")

    assert resp.status_code == 200
    assert "<iframe" in resp.text
    assert "preview.contentcube.cn/preview_1781430809752_8pqecz.html" in resp.text
