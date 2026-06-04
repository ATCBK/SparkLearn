"""外部信息流聚合服务

对接 B站、GitHub、arXiv、掘金等外部数据源，
为学习者提供实时的学习资讯和参考内容。
"""

import logging
import re
from typing import Any
from urllib.parse import quote as url_quote

import httpx

logger = logging.getLogger("info_stream")

# 各数据源的搜索结果统一格式
# {
#   "source": str,        # 数据源名称
#   "external_id": str,   # 外部 ID
#   "title": str,         # 标题
#   "summary": str,       # 摘要
#   "url": str,           # 原始链接
#   "thumbnail": str,     # 缩略图
#   "author": str,        # 作者
#   "tags": list[str],    # 标签
#   "extra_data": dict,   # 各源特有数据
# }


class InfoStreamAggregator:
    """外部信息流聚合器"""

    SOURCES = ["bilibili", "github", "arxiv", "juejin"]
    REQUEST_TIMEOUT_SEC = 5.0

    async def search(
        self,
        keyword: str,
        source: str = "all",
        page: int = 1,
        page_size: int = 10,
    ) -> list[dict[str, Any]]:
        """综合搜索外部信息流"""
        if source == "all":
            # 并发搜索所有源
            import asyncio
            tasks = []
            for src in self.SOURCES:
                tasks.append(self._search_source(src, keyword, page, min(page_size, 5)))
            results = await asyncio.gather(*tasks, return_exceptions=True)
            items = []
            for result in results:
                if isinstance(result, list):
                    items.extend(result)
            # 过滤不相关的结果
            items = self._filter_relevant(items, keyword)
            return items[:page_size]
        else:
            items = await self._search_source(source, keyword, page, page_size)
            return self._filter_relevant(items, keyword)

    def _filter_relevant(self, items: list[dict[str, Any]], keyword: str) -> list[dict[str, Any]]:
        """过滤不相关的结果，只保留与关键词相关的内容"""
        if not keyword.strip():
            return items

        # 将关键词拆分为多个词
        keywords = keyword.lower().split()
        filtered = []

        for item in items:
            title = (item.get("title") or "").lower()
            summary = (item.get("summary") or "").lower()
            tags = [t.lower() for t in (item.get("tags") or [])]
            author = (item.get("author") or "").lower()

            # 检查是否包含任意关键词
            is_relevant = False
            for kw in keywords:
                if (kw in title or kw in summary or
                    any(kw in tag for tag in tags) or kw in author):
                    is_relevant = True
                    break

            if is_relevant:
                filtered.append(item)

        return filtered

    async def _search_source(
        self, source: str, keyword: str, page: int, page_size: int
    ) -> list[dict[str, Any]]:
        """搜索指定数据源"""
        try:
            if source == "bilibili":
                return await self.search_bilibili(keyword, page, page_size)
            elif source == "github":
                return await self.search_github(keyword, page, page_size)
            elif source == "arxiv":
                return await self.search_arxiv(keyword, page, page_size)
            elif source == "juejin":
                return await self.search_juejin(keyword, page, page_size)
            else:
                return []
        except Exception as ex:
            logger.error("搜索 %s 失败: %s", source, ex)
            return []

    async def search_bilibili(self, keyword: str, page: int = 1, page_size: int = 10) -> list[dict[str, Any]]:
        """搜索 B站视频"""
        url = "https://api.bilibili.com/x/web-interface/search/type"
        params = {
            "search_type": "video",
            "keyword": keyword,
            "page": page,
            "page_size": page_size,
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.bilibili.com",
        }

        async with httpx.AsyncClient(timeout=self.REQUEST_TIMEOUT_SEC) as client:
            resp = await client.get(url, params=params, headers=headers)
            data = resp.json()

        items = []
        for video in data.get("data", {}).get("result", []):
            title = re.sub(r"<[^>]+>", "", video.get("title", ""))
            items.append({
                "source": "bilibili",
                "external_id": str(video.get("bvid", "")),
                "title": title,
                "summary": video.get("description", "")[:200],
                "url": f"https://www.bilibili.com/video/{video.get('bvid', '')}",
                "thumbnail": f"https:{video.get('pic', '')}" if video.get("pic", "").startswith("//") else video.get("pic", ""),
                "author": video.get("author", ""),
                "tags": [],
                "extra_data": {
                    "duration": video.get("duration", ""),
                    "play": video.get("play", 0),
                    "danmaku": video.get("video_review", 0),
                },
            })
        return items

    async def search_github(self, keyword: str, page: int = 1, page_size: int = 10) -> list[dict[str, Any]]:
        """搜索 GitHub 仓库"""
        url = "https://api.github.com/search/repositories"
        params = {
            "q": keyword,
            "sort": "stars",
            "order": "desc",
            "page": page,
            "per_page": page_size,
        }
        headers = {"Accept": "application/vnd.github.v3+json"}

        async with httpx.AsyncClient(timeout=self.REQUEST_TIMEOUT_SEC) as client:
            resp = await client.get(url, params=params, headers=headers)
            data = resp.json()

        items = []
        for repo in data.get("items", []):
            items.append({
                "source": "github",
                "external_id": str(repo.get("id", "")),
                "title": repo.get("full_name", ""),
                "summary": (repo.get("description") or "")[:200],
                "url": repo.get("html_url", ""),
                "thumbnail": repo.get("owner", {}).get("avatar_url", ""),
                "author": repo.get("owner", {}).get("login", ""),
                "tags": [lang for lang in [repo.get("language", "")] if lang],
                "extra_data": {
                    "stars": repo.get("stargazers_count", 0),
                    "forks": repo.get("forks_count", 0),
                    "language": repo.get("language", ""),
                    "updated_at": repo.get("updated_at", ""),
                },
            })
        return items

    async def search_arxiv(self, keyword: str, page: int = 1, page_size: int = 10) -> list[dict[str, Any]]:
        """搜索 arXiv 论文"""
        start = (page - 1) * page_size
        url = "http://export.arxiv.org/api/query"
        params = {
            "search_query": f"all:{keyword}",
            "start": start,
            "max_results": page_size,
            "sortBy": "relevance",
            "sortOrder": "descending",
        }

        async with httpx.AsyncClient(timeout=self.REQUEST_TIMEOUT_SEC) as client:
            resp = await client.get(url, params=params)
            text = resp.text

        items = []
        # 简单 XML 解析
        entries = re.findall(r"<entry>(.*?)</entry>", text, re.DOTALL)
        for entry in entries:
            title = re.search(r"<title>(.*?)</title>", entry, re.DOTALL)
            summary = re.search(r"<summary>(.*?)</summary>", entry, re.DOTALL)
            link = re.search(r'<id>(.*?)</id>', entry)
            authors = re.findall(r"<name>(.*?)</name>", entry)

            title_text = title.group(1).strip().replace("\n", " ") if title else ""
            summary_text = summary.group(1).strip().replace("\n", " ")[:200] if summary else ""
            url_text = link.group(1).strip() if link else ""
            author_text = authors[0] if authors else ""

            items.append({
                "source": "arxiv",
                "external_id": url_text.split("/")[-1] if url_text else "",
                "title": title_text,
                "summary": summary_text,
                "url": url_text,
                "thumbnail": "",
                "author": author_text,
                "tags": ["论文"],
                "extra_data": {
                    "authors": authors,
                },
            })
        return items

    async def search_juejin(self, keyword: str, page: int = 1, page_size: int = 10) -> list[dict[str, Any]]:
        """搜索掘金文章"""
        url = "https://api.juejin.cn/search_api/v1/search"
        body = {
            "search_type": 2,  # 文章
            "key_word": keyword,
            "cursor": str((page - 1) * page_size),
            "limit": page_size,
            "sort_type": 0,  # 综合排序
        }

        async with httpx.AsyncClient(timeout=self.REQUEST_TIMEOUT_SEC) as client:
            resp = await client.post(url, json=body)
            data = resp.json()

        items = []
        for article in data.get("data", []):
            info = article.get("result_model", {})
            items.append({
                "source": "juejin",
                "external_id": info.get("article_id", ""),
                "title": info.get("article_info", {}).get("title", ""),
                "summary": info.get("article_info", {}).get("brief_content", "")[:200],
                "url": f"https://juejin.cn/post/{info.get('article_id', '')}",
                "thumbnail": info.get("article_info", {}).get("cover_image", ""),
                "author": info.get("author_user_info", {}).get("user_name", ""),
                "tags": [tag.get("tag_name", "") for tag in info.get("tags", [])[:3]],
                "extra_data": {
                    "views": info.get("article_info", {}).get("view_count", 0),
                    "likes": info.get("article_info", {}).get("digg_count", 0),
                },
            })
        return items


info_aggregator = InfoStreamAggregator()
