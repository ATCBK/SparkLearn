import base64
import hashlib
import hmac
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse

import pytest

from app.xfyun_digital_human_auth import build_xfyun_digital_human_signed_url


def test_生成签名地址并保留原查询参数():
    now = datetime(2026, 8, 20, 2, 0, tzinfo=UTC)
    signed_url = build_xfyun_digital_human_signed_url(
        "wss://avatar.example.com/v1/interact?region=cn-east",
        "test-api-key",
        "test-api-secret",
        now=now,
    )

    parsed = urlparse(signed_url)
    query = parse_qs(parsed.query)

    assert parsed.scheme == "wss"
    assert parsed.netloc == "avatar.example.com"
    assert parsed.path == "/v1/interact"
    assert query["region"] == ["cn-east"]
    assert query["host"] == ["avatar.example.com"]
    assert query["date"] == ["Thu, 20 Aug 2026 02:00:00 GMT"]

    signature_origin = (
        "host: avatar.example.com\n"
        "date: Thu, 20 Aug 2026 02:00:00 GMT\n"
        "GET /v1/interact HTTP/1.1"
    )
    expected_signature = base64.b64encode(
        hmac.new(
            b"test-api-secret",
            signature_origin.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).digest()
    ).decode("utf-8")
    authorization = base64.b64decode(query["authorization"][0]).decode("utf-8")

    assert 'api_key="test-api-key"' in authorization
    assert 'algorithm="hmac-sha256"' in authorization
    assert 'headers="host date request-line"' in authorization
    assert f'signature="{expected_signature}"' in authorization


@pytest.mark.parametrize(
    "base_url",
    [
        "",
        "/vmss",
        "http://avatar.example.com/v1/interact",
        "https://avatar.example.com/v1/interact",
    ],
)
def test_拒绝非安全绝对服务地址(base_url: str):
    with pytest.raises(ValueError, match="安全的绝对地址"):
        build_xfyun_digital_human_signed_url(
            base_url,
            "test-api-key",
            "test-api-secret",
        )


@pytest.mark.parametrize(
    ("api_key", "api_secret"),
    [("", "test-api-secret"), ("test-api-key", "")],
)
def test_拒绝不完整鉴权配置(api_key: str, api_secret: str):
    with pytest.raises(ValueError, match="鉴权配置不完整"):
        build_xfyun_digital_human_signed_url(
            "wss://avatar.example.com/v1/interact",
            api_key,
            api_secret,
        )
