# -*- coding: utf-8 -*-

from app import browser_agent


class _BrokenUser32:
    def EnumWindows(self, callback, lparam) -> None:
        raise RuntimeError("无法枚举 Windows 窗口")


class _BrokenWindll:
    user32 = _BrokenUser32()


class _FakeSearchInput:
    def __init__(self) -> None:
        self.first = self
        self.typed_text = ""

    def click(self) -> None:
        return None

    def type(self, value: str, delay: int = 0) -> None:
        self.typed_text = value

    def press(self, key: str) -> None:
        return None


class _FakePage:
    def __init__(self, goto_errors: list[Exception] | None = None) -> None:
        self.goto_urls: list[str] = []
        self.goto_errors = list(goto_errors or [])
        self.search_input = _FakeSearchInput()
        self.bring_to_front_calls = 0

    def goto(self, url: str, **kwargs) -> None:
        self.goto_urls.append(url)
        if self.goto_errors:
            raise self.goto_errors.pop(0)

    def wait_for_load_state(self, state: str, **kwargs) -> None:
        return None

    def bring_to_front(self) -> None:
        self.bring_to_front_calls += 1

    def locator(self, selector: str) -> _FakeSearchInput:
        return self.search_input

    def evaluate(self, expression: str):
        return None

    def go_back(self) -> None:
        return None


class _FakeContext:
    def __init__(self, page: _FakePage) -> None:
        self.page = page

    def new_page(self) -> _FakePage:
        return self.page

    def close(self) -> None:
        return None


class _FakeBrowser:
    def __init__(self, context: _FakeContext) -> None:
        self.context = context

    def new_context(self, **kwargs) -> _FakeContext:
        return self.context

    def close(self) -> None:
        return None


class _FakePlaywright:
    def __init__(self, browser: _FakeBrowser) -> None:
        self.chromium = self
        self.browser = browser

    def launch(self, **kwargs) -> _FakeBrowser:
        return self.browser


class _FakePlaywrightContextManager:
    def __init__(self, playwright: _FakePlaywright) -> None:
        self.playwright = playwright

    def __enter__(self) -> _FakePlaywright:
        return self.playwright

    def __exit__(self, exc_type, exc, traceback) -> None:
        return None


def test_browser_search_提取搜索页结果后立即返回而不逐个访问链接(monkeypatch):
    page = _FakePage()
    fake_browser = _FakeBrowser(_FakeContext(page))
    fake_playwright = _FakePlaywright(fake_browser)
    results = [
        {
            "title": "Java 基础语法教程",
            "summary": "从变量、流程控制到面向对象的入门教程。",
            "url": "https://example.com/java",
            "source": "example.com",
        },
        {
            "title": "Java 官方学习资料",
            "summary": "Java 官方文档与语言基础说明。",
            "url": "https://example.org/java",
            "source": "example.org",
        },
    ]
    monkeypatch.setattr(
        browser_agent,
        "sync_playwright",
        lambda: _FakePlaywrightContextManager(fake_playwright),
    )
    monkeypatch.setattr(browser_agent.time, "sleep", lambda seconds: None)

    service = browser_agent.BrowserAgentService()
    monkeypatch.setattr(service, "_inject_ai_border", lambda current_page: None)
    monkeypatch.setattr(service, "_extract_bing_results_sync", lambda current_page, limit: results)
    monkeypatch.setattr(service, "_extract_page_content_sync", lambda current_page: "页面正文")

    result = service._search_sync("Java 基础语法", None, max_results=5)

    assert page.search_input.typed_text == "Java 基础语法"
    assert page.goto_urls == ["https://cn.bing.com"]
    assert result == {"items": results}


def test_browser_search_证书校验器瞬时切换时重试一次并返回结果(monkeypatch):
    page = _FakePage(
        goto_errors=[
            RuntimeError(
                "Page.goto: net::ERR_CERT_VERIFIER_CHANGED at https://cn.bing.com/"
            )
        ]
    )
    fake_browser = _FakeBrowser(_FakeContext(page))
    fake_playwright = _FakePlaywright(fake_browser)
    results = [
        {
            "title": "Python 官方教程",
            "summary": "Python 官方入门文档。",
            "url": "https://docs.python.org/zh-cn/3/tutorial/",
            "source": "docs.python.org",
        }
    ]
    monkeypatch.setattr(
        browser_agent,
        "sync_playwright",
        lambda: _FakePlaywrightContextManager(fake_playwright),
    )
    monkeypatch.setattr(browser_agent.time, "sleep", lambda seconds: None)

    service = browser_agent.BrowserAgentService()
    monkeypatch.setattr(service, "_inject_ai_border", lambda current_page: None)
    monkeypatch.setattr(service, "_extract_bing_results_sync", lambda current_page, limit: results)

    result = service._search_sync("Python", None, max_results=5)

    assert page.goto_urls == ["https://cn.bing.com", "https://cn.bing.com"]
    assert result == {"items": results}


def test_browser_search_可见模式激活本次新建的唯一窗口(monkeypatch):
    page = _FakePage()
    fake_browser = _FakeBrowser(_FakeContext(page))
    fake_playwright = _FakePlaywright(fake_browser)
    window_snapshots = iter(({101}, {101, 202}))
    activated_handles: list[int] = []
    results = [
        {
            "title": "Python 官方教程",
            "summary": "Python 官方入门文档。",
            "url": "https://docs.python.org/zh-cn/3/tutorial/",
            "source": "docs.python.org",
        }
    ]
    monkeypatch.setattr(
        browser_agent,
        "sync_playwright",
        lambda: _FakePlaywrightContextManager(fake_playwright),
    )
    monkeypatch.setattr(browser_agent, "_IS_WINDOWS", True)
    monkeypatch.setattr(
        browser_agent,
        "_visible_chromium_window_handles",
        lambda: next(window_snapshots),
        raising=False,
    )
    monkeypatch.setattr(
        browser_agent,
        "_activate_windows_window",
        lambda handle: activated_handles.append(handle) or True,
        raising=False,
    )
    monkeypatch.setattr(browser_agent.time, "sleep", lambda seconds: None)

    service = browser_agent.BrowserAgentService(headless=False)
    monkeypatch.setattr(service, "_inject_ai_border", lambda current_page: None)
    monkeypatch.setattr(service, "_extract_bing_results_sync", lambda current_page, limit: results)

    result = service._search_sync("Python", None, max_results=5)

    assert page.bring_to_front_calls == 1
    assert activated_handles == [202]
    assert result == {"items": results}


def test_browser_search_窗口候选不唯一时只激活标签页(monkeypatch):
    page = _FakePage()
    fake_browser = _FakeBrowser(_FakeContext(page))
    fake_playwright = _FakePlaywright(fake_browser)
    window_snapshots = iter(({101}, {101, 202, 303}))
    activated_handles: list[int] = []
    monkeypatch.setattr(
        browser_agent,
        "sync_playwright",
        lambda: _FakePlaywrightContextManager(fake_playwright),
    )
    monkeypatch.setattr(browser_agent, "_IS_WINDOWS", True)
    monkeypatch.setattr(
        browser_agent,
        "_visible_chromium_window_handles",
        lambda: next(window_snapshots),
        raising=False,
    )
    monkeypatch.setattr(
        browser_agent,
        "_activate_windows_window",
        lambda handle: activated_handles.append(handle) or True,
        raising=False,
    )
    monkeypatch.setattr(browser_agent.time, "sleep", lambda seconds: None)

    service = browser_agent.BrowserAgentService(headless=False)
    monkeypatch.setattr(service, "_inject_ai_border", lambda current_page: None)
    monkeypatch.setattr(
        service,
        "_extract_bing_results_sync",
        lambda current_page, limit: [],
    )
    monkeypatch.setattr(service, "_extract_from_page_js", lambda current_page, limit: [])

    result = service._search_sync("热搜", None, max_results=5)

    assert page.bring_to_front_calls == 1
    assert activated_handles == []
    assert result == {"items": []}


def test_browser_search_系统级窗口激活失败不中断检索(monkeypatch):
    page = _FakePage()
    fake_browser = _FakeBrowser(_FakeContext(page))
    fake_playwright = _FakePlaywright(fake_browser)
    window_snapshots = iter(({101}, {101, 202}))
    activation_attempts: list[int] = []
    results = [
        {
            "title": "Python 官方教程",
            "summary": "Python 官方入门文档。",
            "url": "https://docs.python.org/zh-cn/3/tutorial/",
            "source": "docs.python.org",
        }
    ]

    def fail_to_activate(handle: int) -> bool:
        activation_attempts.append(handle)
        raise RuntimeError("Windows 拒绝切换前台窗口")

    monkeypatch.setattr(
        browser_agent,
        "sync_playwright",
        lambda: _FakePlaywrightContextManager(fake_playwright),
    )
    monkeypatch.setattr(browser_agent, "_IS_WINDOWS", True)
    monkeypatch.setattr(
        browser_agent,
        "_visible_chromium_window_handles",
        lambda: next(window_snapshots),
    )
    monkeypatch.setattr(browser_agent, "_activate_windows_window", fail_to_activate)
    monkeypatch.setattr(browser_agent.time, "sleep", lambda seconds: None)

    service = browser_agent.BrowserAgentService(headless=False)
    monkeypatch.setattr(service, "_inject_ai_border", lambda current_page: None)
    monkeypatch.setattr(service, "_extract_bing_results_sync", lambda current_page, limit: results)

    result = service._search_sync("Python", None, max_results=5)

    assert activation_attempts == [202]
    assert page.search_input.typed_text == "Python"
    assert result == {"items": results}


def test_browser_search_窗口快照失败与没有已有窗口严格区分(monkeypatch):
    monkeypatch.setattr(browser_agent, "_IS_WINDOWS", True)
    monkeypatch.setattr(browser_agent.ctypes, "windll", _BrokenWindll())

    assert browser_agent._visible_chromium_window_handles() is None
