"""
Browser Agent Service - Real browser automation with Playwright.
Runs sync Playwright in a thread pool to avoid Windows event loop conflicts.
Shows the FULL browsing process: open, type, search, scroll, click results, read pages, go back.
"""
from __future__ import annotations

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

logger = logging.getLogger("browser_agent")

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="browser_agent")


class BrowserAgentService:

    def __init__(self, headless: bool = True, slow_mo: int = 0):
        self.headless = headless
        self.slow_mo = slow_mo

    async def search(self, query: str, on_step: Callable[[int, str, str], None] | None = None, max_results: int = 5) -> dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_executor, self._search_sync, query, on_step, max_results)

    async def summarize_url(self, url: str, on_step: Callable[[int, str, str], None] | None = None) -> dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_executor, self._summarize_sync, url, on_step)

    async def compare_search(self, query: str, on_step: Callable[[int, str, str], None] | None = None, num_sources: int = 3) -> dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_executor, self._compare_sync, query, on_step, num_sources)

    # ========== SEARCH: Full browsing demo ==========

    def _search_sync(self, query: str, on_step: Callable | None, max_results: int) -> dict[str, Any]:
        def step(idx: int, action: str, desc: str):
            if on_step:
                on_step(idx, action, desc)

        step(1, "start", "正在启动浏览器...")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless, slow_mo=self.slow_mo)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale="zh-CN",
                viewport={"width": 1280, "height": 800},
            )
            page = context.new_page()

            try:
                # Step 1: Open Bing homepage
                step(2, "navigate", "正在打开 Bing 搜索引擎...")
                page.goto("https://cn.bing.com", timeout=20000)
                page.wait_for_load_state("domcontentloaded")
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

                # Step 6-N: Click into each result, scroll/read, then go back
                enriched = []
                step_idx = 7
                for i, result in enumerate(results[:3]):
                    if not result.get("url"):
                        enriched.append(result)
                        continue

                    # Click the result link
                    step(step_idx, "click", f"点击第 {i+1} 条结果: 「{result['title'][:25]}」...")
                    step_idx += 1
                    try:
                        page.goto(result["url"], timeout=12000)
                        page.wait_for_load_state("domcontentloaded")
                        time.sleep(1)

                        # Scroll down to read the page content
                        step(step_idx, "scroll", f"正在阅读第 {i+1} 篇文章...")
                        step_idx += 1
                        for y in [300, 600, 900]:
                            page.evaluate(f"window.scrollTo(0, {y})")
                            time.sleep(0.6)

                        # Extract content from the page
                        step(step_idx, "extract", f"提取第 {i+1} 篇文章要点...")
                        step_idx += 1
                        content = self._extract_page_content_sync(page)
                        if content and len(content) > 20:
                            result["summary"] = content[:200]

                        enriched.append(result)

                        # Go back to search results
                        step(step_idx, "navigate", "返回搜索结果页...")
                        step_idx += 1
                        page.go_back()
                        page.wait_for_load_state("domcontentloaded")
                        time.sleep(1)

                    except Exception:
                        enriched.append(result)
                        try:
                            page.go_back()
                            time.sleep(0.5)
                        except Exception:
                            pass

                # Add remaining results that we didn't click into
                for result in results[3:]:
                    enriched.append(result)

                step(30, "done", f"搜索完成！共找到 {len(enriched)} 条相关资源")
                return {"items": enriched}

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
