"""
Browser Agent Service - Real browser automation with Playwright.
Runs sync Playwright in a thread pool to avoid Windows event loop conflicts.
Shows the browsing process: open, type, search, scroll, and extract the result list.
"""
from __future__ import annotations

import asyncio
import ctypes
import logging
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from ctypes import wintypes
from typing import Any, Callable
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

logger = logging.getLogger("browser_agent")

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="browser_agent")
_IS_WINDOWS = sys.platform == "win32"


def _visible_chromium_window_handles() -> set[int] | None:
    """获取当前可见的 Chromium 顶层窗口。

    这里只做窗口快照，后续会用“启动前/启动后”差集锁定本次 Playwright
    新建的窗口，避免误激活用户已有的 Chrome 窗口。
    """
    if not _IS_WINDOWS:
        return set()

    try:
        user32 = ctypes.windll.user32
        handles: set[int] = set()
        enum_windows_proc = ctypes.WINFUNCTYPE(
            wintypes.BOOL,
            wintypes.HWND,
            wintypes.LPARAM,
        )

        @enum_windows_proc
        def collect_window(hwnd, _lparam):
            if not user32.IsWindowVisible(hwnd):
                return True

            class_name = ctypes.create_unicode_buffer(256)
            if not user32.GetClassNameW(hwnd, class_name, len(class_name)):
                return True
            if class_name.value != "Chrome_WidgetWin_1":
                return True

            # 排除有 owner 的弹窗，只保留可独立切换的顶层浏览器窗口。
            if user32.GetWindow(hwnd, 4):  # GW_OWNER
                return True
            handles.add(int(hwnd))
            return True

        user32.EnumWindows(collect_window, 0)
        return handles
    except Exception:
        logger.exception("获取 Chromium 窗口快照失败。")
        return None


def _activate_windows_window(handle: int) -> bool:
    """恢复并激活指定 Windows 窗口，返回是否真正成为前台窗口。"""
    if not _IS_WINDOWS or not handle:
        return False

    attached_threads: set[tuple[int, int]] = set()
    try:
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32
        user32.GetForegroundWindow.restype = wintypes.HWND
        user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.c_void_p]
        user32.GetWindowThreadProcessId.restype = wintypes.DWORD

        hwnd = wintypes.HWND(handle)

        def activate() -> None:
            user32.ShowWindow(hwnd, 9)  # SW_RESTORE
            user32.BringWindowToTop(hwnd)
            user32.SetForegroundWindow(hwnd)
            user32.SetActiveWindow(hwnd)

        activate()
        if int(user32.GetForegroundWindow() or 0) == handle:
            return True

        # Windows 会限制后台进程抢前台。短暂关联相关输入线程后再激活，
        # 随后立即解除关联，不会改变其他窗口的置顶状态。
        current_thread = int(kernel32.GetCurrentThreadId())
        target_thread = int(user32.GetWindowThreadProcessId(hwnd, None))
        foreground = user32.GetForegroundWindow()
        foreground_thread = (
            int(user32.GetWindowThreadProcessId(foreground, None))
            if foreground
            else 0
        )

        for source_thread, destination_thread in (
            (current_thread, foreground_thread),
            (current_thread, target_thread),
        ):
            if (
                source_thread
                and destination_thread
                and source_thread != destination_thread
                and user32.AttachThreadInput(
                    source_thread,
                    destination_thread,
                    True,
                )
            ):
                attached_threads.add((source_thread, destination_thread))

        activate()
        return int(user32.GetForegroundWindow() or 0) == handle
    except Exception:
        logger.exception("激活新建 Chromium 窗口失败。")
        return False
    finally:
        if attached_threads:
            try:
                user32 = ctypes.windll.user32
                for source_thread, destination_thread in attached_threads:
                    user32.AttachThreadInput(
                        source_thread,
                        destination_thread,
                        False,
                    )
            except Exception:
                logger.exception("解除 Windows 输入线程关联失败。")


class BrowserAgentService:

    def __init__(self, headless: bool = True, slow_mo: int = 0):
        self.headless = headless
        self.slow_mo = slow_mo

    def _focus_search_window(
        self,
        page: Any,
        existing_handles: set[int] | None,
    ) -> None:
        """激活搜索标签页，并安全地将本次新建窗口切到 Windows 前台。"""
        try:
            page.bring_to_front()
        except Exception:
            logger.exception("激活 Playwright 搜索标签页失败，将继续检索。")

        if self.headless or not _IS_WINDOWS:
            return
        if existing_handles is None:
            logger.warning(
                "启动前窗口快照不可用，为避免误激活已跳过系统级切换。"
            )
            return

        try:
            for _ in range(20):
                current_handles = _visible_chromium_window_handles()
                if current_handles is None:
                    logger.warning(
                        "启动后窗口快照不可用，为避免误激活已跳过系统级切换。"
                    )
                    return
                new_handles = current_handles - existing_handles
                if len(new_handles) == 1:
                    handle = next(iter(new_handles))
                    if not _activate_windows_window(handle):
                        logger.warning(
                            "新建 Chromium 窗口未能成为前台窗口，将继续检索。"
                        )
                    return
                if len(new_handles) > 1:
                    logger.warning(
                        "检测到 %s 个新 Chromium 窗口，为避免误激活已跳过系统级切换。",
                        len(new_handles),
                    )
                    return
                time.sleep(0.1)
            logger.warning("未识别到本次新建的 Chromium 窗口，将继续检索。")
        except Exception:
            logger.exception("切换新建 Chromium 窗口时出错，将继续检索。")

    async def search(self, query: str, on_step: Callable[[int, str, str], None] | None = None, max_results: int = 5) -> dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_executor, self._search_sync, query, on_step, max_results)

    async def summarize_url(self, url: str, on_step: Callable[[int, str, str], None] | None = None) -> dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_executor, self._summarize_sync, url, on_step)

    async def summarize_url_with_plan(
        self,
        url: str,
        action_plan: list[dict[str, Any]],
        on_step: Callable[[int, str, str], None] | None = None,
    ) -> dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_executor, self._summarize_with_plan_sync, url, action_plan, on_step)

    async def summarize_from_homepage_search(
        self,
        query: str,
        target_url: str = "",
        on_step: Callable[[int, str, str], None] | None = None,
    ) -> dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_executor, self._summarize_from_homepage_search_sync, query, target_url, on_step)

    async def compare_search(self, query: str, on_step: Callable[[int, str, str], None] | None = None, num_sources: int = 3) -> dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_executor, self._compare_sync, query, on_step, num_sources)

    # ========== SEARCH: Full browsing demo ==========

    def _search_sync(self, query: str, on_step: Callable | None, max_results: int) -> dict[str, Any]:
        def step(idx: int, action: str, desc: str):
            if on_step:
                on_step(idx, action, desc)

        step(1, "start", "正在启动浏览器...")

        existing_browser_windows = (
            _visible_chromium_window_handles()
            if not self.headless and _IS_WINDOWS
            else set()
        )

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless, slow_mo=self.slow_mo)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale="zh-CN",
                viewport={"width": 1280, "height": 800},
            )
            page = context.new_page()
            self._inject_ai_border(page)

            try:
                # Step 1: Open Bing homepage
                step(2, "navigate", "正在打开 Bing 搜索引擎...")
                try:
                    page.goto("https://cn.bing.com", timeout=20000)
                except Exception as ex:
                    if "net::ERR_CERT_VERIFIER_CHANGED" not in str(ex):
                        raise
                    logger.warning("Chromium 证书校验器发生瞬时切换，正在重试 Bing 导航。")
                    step(2, "navigate", "浏览器网络状态刚刚变化，正在重新打开 Bing...")
                    time.sleep(0.5)
                    page.goto("https://cn.bing.com", timeout=20000)
                page.wait_for_load_state("domcontentloaded")
                self._focus_search_window(page, existing_browser_windows)
                time.sleep(1)

                # Step 2: Click search box and type query character by character
                step(3, "input", f'输入搜索关键词: "{query}"')
                search_input = page.locator('input[name="q"], #sb_form_q, textarea[name="q"]').first
                search_input.click()
                time.sleep(0.3)
                search_input.type(query, delay=100)
                time.sleep(0.5)

                # Step 3: Press Enter to search
                step(4, "click", "点击搜索按钮...")
                search_input.press("Enter")
                page.wait_for_load_state("domcontentloaded")
                time.sleep(2)

                # Step 4: Slowly scroll through search results so viewer can see them
                step(5, "scroll", "浏览搜索结果列表...")
                for y in [200, 400, 600]:
                    page.evaluate(f"window.scrollTo(0, {y})")
                    time.sleep(0.7)
                page.evaluate("window.scrollTo(0, 0)")
                time.sleep(0.5)

                # Step 5: Extract search result links
                step(6, "extract", "识别搜索结果...")
                results = self._extract_bing_results_sync(page, max_results)
                if not results:
                    results = self._extract_from_page_js(page, max_results)

                if not results:
                    step(20, "done", "未找到搜索结果")
                    return {"items": []}

                step(20, "done", f"搜索完成！共找到 {len(results)} 条相关资源")
                return {"items": results}

            except Exception as ex:
                logger.exception("Browser search failed")
                step(30, "error", f"搜索出错: {str(ex)[:100]}")
                return {"items": [], "error": str(ex)[:200]}
            finally:
                time.sleep(1)
                context.close()
                browser.close()

    # ========== SUMMARIZE: Visit URL and read ==========

    def _summarize_sync(self, url: str, on_step: Callable | None) -> dict[str, Any]:
        def step(idx: int, action: str, desc: str):
            if on_step:
                on_step(idx, action, desc)

        step(1, "start", "正在启动浏览器...")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless, slow_mo=self.slow_mo)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                locale="zh-CN",
                viewport={"width": 1280, "height": 800},
            )
            page = context.new_page()
            self._inject_ai_border(page)

            try:
                step(2, "navigate", f"正在访问页面...")
                page.goto(url, timeout=20000)
                page.wait_for_load_state("domcontentloaded")
                time.sleep(1)

                title = page.title()
                step(3, "extract", f"页面标题: 「{title[:40]}」")

                # Scroll through the page to "read" it
                step(4, "scroll", "正在阅读文章内容...")
                for y in [300, 600, 900, 1200]:
                    page.evaluate(f"window.scrollTo(0, {y})")
                    time.sleep(0.8)

                step(5, "extract", "正在提取文章正文...")
                content = self._extract_page_content_sync(page)

                step(6, "done", f"内容提取完成，共 {len(content)} 字")
                return {"title": title, "content": content[:5000], "url": url}

            except Exception as ex:
                logger.exception("Browser summarize failed")
                step(6, "error", f"访问出错: {str(ex)[:100]}")
                return {"title": "", "content": "", "url": url, "error": str(ex)[:200]}
            finally:
                time.sleep(1)
                context.close()
                browser.close()

    def _summarize_from_homepage_search_sync(self, query: str, target_url: str, on_step: Callable | None) -> dict[str, Any]:
        def step(idx: int, action: str, desc: str):
            if on_step:
                on_step(idx, action, desc)

        step(1, "start", "正在启动可见浏览器，讯飞星火将通过搜索首页查找页面...")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless, slow_mo=self.slow_mo)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale="zh-CN",
                viewport={"width": 1280, "height": 800},
            )
            page = context.new_page()
            self._inject_ai_border(page)

            try:
                step(2, "navigate", "打开 Bing 搜索首页")
                page.goto("https://cn.bing.com", timeout=30000, wait_until="domcontentloaded")
                self._ensure_ai_glow(page)
                time.sleep(0.8)

                step(3, "input", f"在搜索框输入：{query[:80]}")
                search_input = page.locator('input[name="q"], #sb_form_q, textarea[name="q"]').first
                search_input.click()
                search_input.fill("")
                search_input.type(query, delay=80)
                time.sleep(0.5)

                step(4, "click", "提交搜索")
                search_input.press("Enter")
                page.wait_for_load_state("domcontentloaded", timeout=20000)
                self._ensure_ai_glow(page)
                time.sleep(1.2)

                step(5, "scroll", "浏览搜索结果列表")
                for y in [220, 520, 0]:
                    page.evaluate(f"window.scrollTo(0, {y})")
                    self._ensure_ai_glow(page)
                    time.sleep(0.6)

                results = self._extract_bing_results_sync(page, 6)
                if not results:
                    results = self._extract_from_page_js(page, 6)

                chosen = None
                target_domain = self._domain(target_url) if target_url else ""
                for item in results:
                    item_url = str(item.get("url") or "")
                    if target_url and (target_url in item_url or (target_domain and target_domain in self._domain(item_url))):
                        chosen = item
                        break
                if chosen is None and results:
                    chosen = results[0]

                if chosen and chosen.get("url"):
                    step(6, "click", f"打开搜索结果：{str(chosen.get('title') or '')[:40]}")
                    page.goto(str(chosen["url"]), timeout=45000, wait_until="domcontentloaded")
                    self._ensure_ai_glow(page)
                elif target_url:
                    step(6, "navigate", "搜索结果未命中目标页面，打开用户提供的链接")
                    page.goto(target_url, timeout=45000, wait_until="domcontentloaded")
                    self._ensure_ai_glow(page)
                else:
                    step(6, "extract", "没有可打开的搜索结果，提取搜索页内容")

                title = page.title()
                step(7, "scroll", "滚动阅读页面内容")
                for y in [320, 760, 1180, 1560]:
                    page.evaluate(f"window.scrollTo(0, {y})")
                    self._ensure_ai_glow(page)
                    time.sleep(0.7)

                step(8, "extract", "提取当前页面正文")
                content = self._extract_page_content_sync(page)
                step(9, "done", f"浏览器操作完成，提取正文 {len(content)} 字")
                return {"title": title, "content": content[:6000], "url": page.url}
            except Exception as ex:
                logger.exception("Homepage search summarize failed")
                step(9, "error", f"浏览器搜索操作失败: {str(ex)[:100]}")
                return {"title": "", "content": "", "url": target_url, "error": str(ex)[:200]}
            finally:
                time.sleep(1)
                context.close()
                browser.close()

    def _summarize_with_plan_sync(self, url: str, action_plan: list[dict[str, Any]], on_step: Callable | None) -> dict[str, Any]:
        def step(idx: int, action: str, desc: str):
            if on_step:
                on_step(idx, action, desc)

        safe_plan = action_plan if isinstance(action_plan, list) and action_plan else [
            {"action": "navigate", "reason": "打开用户提供的页面"},
            {"action": "wait", "seconds": 1, "reason": "等待页面主要内容加载"},
            {"action": "scroll", "y": 400, "reason": "阅读页面上半部分"},
            {"action": "scroll", "y": 900, "reason": "阅读页面中部内容"},
            {"action": "scroll", "y": 1400, "reason": "阅读页面下半部分"},
            {"action": "extract", "reason": "提取正文用于总结"},
        ]

        step(1, "start", "正在启动可见浏览器，执行 DeepSeek 规划的操作...")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless, slow_mo=self.slow_mo)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale="zh-CN",
                viewport={"width": 1280, "height": 800},
            )
            page = context.new_page()
            self._inject_ai_border(page)

            title = ""
            content = ""
            visited = False
            try:
                for index, item in enumerate(safe_plan[:8], start=2):
                    action = str(item.get("action") or "").lower().strip()
                    reason = str(item.get("reason") or "")
                    if action == "navigate":
                        step(index, "navigate", reason or "DeepSeek 指示：打开目标页面")
                        try:
                            page.goto(url, timeout=45000, wait_until="domcontentloaded")
                        except Exception as ex:
                            step(index, "navigate", f"页面仍在加载，继续执行后续动作: {str(ex)[:80]}")
                            try:
                                page.wait_for_load_state("domcontentloaded", timeout=5000)
                            except Exception:
                                pass
                        visited = True
                        try:
                            title = page.title()
                        except Exception:
                            title = ""
                        time.sleep(0.8)
                    elif action == "wait":
                        seconds = float(item.get("seconds") or 1)
                        seconds = max(0.3, min(seconds, 3.0))
                        step(index, "wait", reason or f"DeepSeek 指示：等待 {seconds:.1f} 秒")
                        time.sleep(seconds)
                    elif action == "scroll":
                        if not visited:
                            step(index, "navigate", "DeepSeek 指示滚动前先打开目标页面")
                            try:
                                page.goto(url, timeout=45000, wait_until="domcontentloaded")
                            except Exception as ex:
                                step(index, "navigate", f"页面仍在加载，继续滚动观察: {str(ex)[:80]}")
                            visited = True
                            try:
                                title = page.title()
                            except Exception:
                                title = ""
                        y = int(item.get("y") or item.get("pixels") or 600)
                        y = max(0, min(y, 5000))
                        step(index, "scroll", reason or f"DeepSeek 指示：滚动到 {y}px 观察页面内容")
                        page.evaluate(f"window.scrollTo(0, {y})")
                        time.sleep(0.8)
                    elif action == "extract":
                        if not visited:
                            step(index, "navigate", "DeepSeek 指示提取前先打开目标页面")
                            try:
                                page.goto(url, timeout=45000, wait_until="domcontentloaded")
                            except Exception as ex:
                                step(index, "navigate", f"页面仍在加载，尝试提取已有内容: {str(ex)[:80]}")
                            visited = True
                        try:
                            title = page.title()
                        except Exception:
                            title = ""
                        step(index, "extract", reason or "DeepSeek 指示：提取页面正文")
                        content = self._extract_page_content_sync(page)
                    else:
                        step(index, "skip", f"跳过不支持的动作：{action or 'unknown'}")

                if not visited:
                    step(20, "navigate", "DeepSeek 计划未包含导航，自动打开目标页面")
                    try:
                        page.goto(url, timeout=45000, wait_until="domcontentloaded")
                    except Exception as ex:
                        step(20, "navigate", f"页面仍在加载，尝试继续: {str(ex)[:80]}")
                    try:
                        title = page.title()
                    except Exception:
                        title = ""

                if not content:
                    step(21, "extract", "提取页面正文用于 DeepSeek 总结")
                    content = self._extract_page_content_sync(page)

                step(22, "done", f"浏览器操作完成，提取正文 {len(content)} 字")
                return {"title": title, "content": content[:6000], "url": url}
            except Exception as ex:
                logger.exception("DeepSeek planned browser summarize failed")
                step(22, "error", f"浏览器操作失败: {str(ex)[:100]}")
                return {"title": title, "content": content, "url": url, "error": str(ex)[:200]}
            finally:
                time.sleep(1)
                context.close()
                browser.close()

    # ========== COMPARE: Search + visit multiple pages ==========

    def _compare_sync(self, query: str, on_step: Callable | None, num_sources: int) -> dict[str, Any]:
        def step(idx: int, action: str, desc: str):
            if on_step:
                on_step(idx, action, desc)

        step(1, "start", "正在启动浏览器...")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless, slow_mo=self.slow_mo)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                locale="zh-CN",
                viewport={"width": 1280, "height": 800},
            )
            page = context.new_page()
            self._inject_ai_border(page)

            try:
                # Search
                step(2, "navigate", "正在打开 Bing 搜索引擎...")
                page.goto("https://cn.bing.com", timeout=20000)
                page.wait_for_load_state("domcontentloaded")
                time.sleep(1)

                step(3, "input", f'输入对比搜索: "{query}"')
                search_input = page.locator('input[name="q"], #sb_form_q, textarea[name="q"]').first
                search_input.click()
                time.sleep(0.3)
                search_input.type(query, delay=100)
                search_input.press("Enter")
                page.wait_for_load_state("domcontentloaded")
                time.sleep(2)

                step(4, "scroll", "浏览搜索结果...")
                page.evaluate("window.scrollBy(0, 400)")
                time.sleep(1)

                step(5, "extract", "识别搜索结果链接...")
                results = self._extract_bing_results_sync(page, num_sources + 2)
                if not results:
                    results = self._extract_from_page_js(page, num_sources + 2)

                # Visit each result
                sources = []
                step_idx = 6
                for result in results:
                    if len(sources) >= num_sources:
                        break
                    if not result.get("url"):
                        continue

                    step(step_idx, "click", f"访问第 {len(sources)+1} 个来源: 「{result['title'][:25]}」...")
                    step_idx += 1
                    try:
                        page.goto(result["url"], timeout=10000)
                        page.wait_for_load_state("domcontentloaded")
                        time.sleep(1)

                        step(step_idx, "scroll", f"阅读第 {len(sources)+1} 个来源内容...")
                        step_idx += 1
                        for y in [300, 600]:
                            page.evaluate(f"window.scrollTo(0, {y})")
                            time.sleep(0.6)

                        content = self._extract_page_content_sync(page)
                        sources.append({
                            "source": result.get("title", f"来源 {len(sources)+1}"),
                            "url": result["url"],
                            "explanation": content[:300] if content else result.get("summary", ""),
                        })

                        # Go back
                        step(step_idx, "navigate", "返回搜索结果...")
                        step_idx += 1
                        page.go_back()
                        page.wait_for_load_state("domcontentloaded")
                        time.sleep(1)
                    except Exception:
                        continue

                step(30, "done", f"对比完成！访问了 {len(sources)} 个来源")
                return {"items": sources, "comparison": ""}

            except Exception as ex:
                logger.exception("Browser compare failed")
                step(30, "error", f"对比搜索出错: {str(ex)[:100]}")
                return {"items": [], "comparison": "", "error": str(ex)[:200]}
            finally:
                time.sleep(1)
                context.close()
                browser.close()

    # ========== Extraction helpers ==========

    def _inject_ai_border(self, page):
        """注入彩色炫光边框到页面最外层，表示 AI 正在控制"""
        css = """
            @keyframes ai-rainbow-border {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            #__ai_glow_overlay__ {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                pointer-events: none;
                border: 4px solid transparent;
                background: linear-gradient(90deg, #ff0080, #ff8c00, #40e0d0, #7b68ee, #ff0080) border-box;
                -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                background-size: 300% 300%;
                animation: ai-rainbow-border 3s linear infinite;
                border-radius: 0;
            }
        """
        js_inject = """
            if (!document.getElementById('__ai_glow_overlay__')) {
                const style = document.createElement('style');
                style.id = '__ai_glow_style__';
                style.textContent = `""" + css.replace('`', '\\`').replace('\n', ' ') + """`;
                document.head.appendChild(style);
                const div = document.createElement('div');
                div.id = '__ai_glow_overlay__';
                document.body.appendChild(div);
            }
        """
        page.on("load", lambda: page.evaluate(f"() => {{ {js_inject} }}"))
        page.add_init_script(js_inject)

    def _ai_glow_script(self) -> str:
        return """
            (() => {
                const styleId = '__sparklearn_ai_agent_glow_style__';
                const edgePrefix = '__sparklearn_ai_agent_edge_';
                const oldOverlay = document.getElementById('__sparklearn_ai_agent_glow__');
                if (oldOverlay) oldOverlay.remove();
                if (!document.getElementById(styleId)) {
                    const style = document.createElement('style');
                    style.id = styleId;
                    style.textContent = `
                        @keyframes sparklearnAgentGlowShift {
                            0% { background-position: 0% 50%; filter: hue-rotate(0deg); }
                            50% { background-position: 100% 50%; filter: hue-rotate(35deg); }
                            100% { background-position: 0% 50%; filter: hue-rotate(0deg); }
                        }
                        @keyframes sparklearnAgentPulse {
                            0%, 100% { opacity: .82; transform: scale(1); }
                            50% { opacity: 1; transform: scale(1.006); }
                        }
                        .__sparklearn_ai_agent_edge__ {
                            position: fixed;
                            z-index: 2147483647;
                            pointer-events: none;
                            box-sizing: border-box;
                            background: linear-gradient(120deg, #22d3ee, #2563eb, #a855f7, #ec4899, #f59e0b, #22d3ee);
                            background-size: 320% 320%;
                            animation: sparklearnAgentGlowShift 3.2s linear infinite, sparklearnAgentPulse 1.8s ease-in-out infinite;
                            box-shadow: 0 0 14px rgba(37,99,235,.22);
                        }
                        #${edgePrefix}top { left: 0; top: 0; width: 100vw; height: 5px; }
                        #${edgePrefix}right { right: 0; top: 0; width: 5px; height: 100vh; }
                        #${edgePrefix}bottom { left: 0; bottom: 0; width: 100vw; height: 5px; }
                        #${edgePrefix}left { left: 0; top: 0; width: 5px; height: 100vh; }
                    `;
                    document.head.appendChild(style);
                }
                for (const side of ['top', 'right', 'bottom', 'left']) {
                    const id = edgePrefix + side;
                    if (!document.getElementById(id)) {
                        const edge = document.createElement('div');
                        edge.id = id;
                        edge.className = '__sparklearn_ai_agent_edge__';
                        document.documentElement.appendChild(edge);
                    }
                }
            })();
        """

    def _ensure_ai_glow(self, page):
        try:
            page.evaluate(self._ai_glow_script())
        except Exception:
            pass

    def _inject_ai_border(self, page):
        """Inject a visible agent-control glow overlay into every page."""
        script = self._ai_glow_script()
        page.add_init_script(script)
        page.on("domcontentloaded", lambda: self._ensure_ai_glow(page))
        page.on("load", lambda: self._ensure_ai_glow(page))
        self._ensure_ai_glow(page)

    def _extract_bing_results_sync(self, page, max_results: int) -> list[dict]:
        results: list[dict] = []
        for selector in ["#b_results > li.b_algo", ".b_algo", "#b_results li.b_algo"]:
            items = page.locator(selector)
            count = items.count()
            if count > 0:
                for i in range(min(count, max_results)):
                    try:
                        item = items.nth(i)
                        title, url = "", ""
                        for ts in ["h2 a", "h2 > a", ".b_title a", "h2"]:
                            el = item.locator(ts).first
                            if el.count() > 0:
                                title = el.inner_text().strip()
                                url = el.get_attribute("href") or ""
                                break
                        summary = ""
                        for ds in [".b_caption p", "p", ".b_lineclamp2"]:
                            el = item.locator(ds).first
                            if el.count() > 0:
                                summary = el.inner_text().strip()
                                if len(summary) > 10:
                                    break
                        if title and len(title) > 2:
                            results.append({"title": title[:100], "summary": summary[:200], "url": url, "source": self._domain(url)})
                    except Exception:
                        continue
                if results:
                    break
        return results

    def _extract_from_page_js(self, page, max_results: int) -> list[dict]:
        results: list[dict] = []
        try:
            data = page.evaluate("""() => {
                const r = [];
                for (const a of document.querySelectorAll('#b_results a, .b_algo a, main a')) {
                    const h = a.href, t = a.innerText.trim();
                    if (h && t && t.length > 5 && !h.includes('bing.com') && !h.includes('microsoft.com') && h.startsWith('http'))
                        r.push({title: t, url: h});
                }
                return r.slice(0, 10);
            }""")
            for item in data[:max_results]:
                results.append({"title": item["title"][:100], "summary": "", "url": item["url"], "source": self._domain(item["url"])})
        except Exception:
            pass
        return results

    def _extract_page_content_sync(self, page) -> str:
        for sel in ["article", "main", ".content", "#content", ".post-content", ".article-content"]:
            el = page.locator(sel).first
            if el.count() > 0:
                text = el.inner_text()
                if text and len(text) > 50:
                    return self._clean(text)
        return self._clean(page.locator("body").inner_text())[:3000]

    def _clean(self, text: str) -> str:
        lines = [l.strip() for l in text.split("\n") if l.strip() and len(l.strip()) > 3]
        return "\n".join(lines[:100])

    def _domain(self, url: str) -> str:
        try:
            return urlparse(url).netloc.replace("www.", "")
        except Exception:
            return ""


# --- Global instance from config ---

browser_agent = None

def _get_agent() -> BrowserAgentService:
    global browser_agent
    if browser_agent is None:
        from .config import settings
        browser_agent = BrowserAgentService(
            headless=settings.agent_browser_headless,
            slow_mo=settings.agent_browser_slow_mo,
        )
    return browser_agent
