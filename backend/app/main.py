import asyncio
from contextlib import asynccontextmanager
import logging
import sys
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .config import settings
from .db import init_db
from .auth import initialize_configured_demo_user, router as auth_router
from .routes.learning import router as learning_router
from .routes.graph import router as graph_router
from .routes.memory import router as memory_router
from .routes.knowledge import router as knowledge_router
from .routes.path_planning import router as path_planning_router
from .routes.ppt import router as ppt_router
from .routes.profile import router as profile_router
from .routes.quiz import router as quiz_router
from .routes.resources import router as resources_router
from .routes.tutor_eval import router as tutor_eval_router
from .routes.video import router as video_router
from .routes.voice_admin import router as voice_admin_router
from .routes.agent import router as agent_router
from .routes.teacher import router as teacher_router
from .routes.forum import router as forum_router
from .routes.mcp import router as mcp_router
from .routes.sharing import router as sharing_router
from .routes.info_stream import router as info_stream_router
from .routes.num_person import router as num_person_router
from .routes.code_runner import router as code_runner_router
from .routes.admin import router as admin_router


logging.basicConfig(
    level=logging.DEBUG if settings.debug.lower() == "true" else logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


def _log_model_config_sanity() -> None:
    logger = logging.getLogger("startup")
    default_model = (settings.spark_default_model or "").strip().lower()
    if default_model in {"qwen-plus"} and not settings.dashscope_api_key:
        logger.warning(
            "spark_default_model=%s but dashscope_api_key is empty; requests may return 401 from DashScope.",
            settings.spark_default_model,
        )
    if default_model in {"ds-flash", "ds-pro"} and not settings.deepseek_api_key:
        logger.warning(
            "spark_default_model=%s but deepseek_api_key is empty; requests may fall back or fail.",
            settings.spark_default_model,
        )


def _configure_event_loop_policy() -> None:
    # Windows + Playwright needs Proactor loop for subprocess support.
    if sys.platform.startswith("win"):
        try:
            policy = asyncio.get_event_loop_policy()
            if not isinstance(policy, asyncio.WindowsProactorEventLoopPolicy):
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        except Exception:
            # Keep startup resilient; route-level errors will still surface if env is incompatible.
            pass


_configure_event_loop_policy()


class RequestLoggingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.logger = logging.getLogger("request")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.monotonic()
        method = scope.get("method", "")
        path = scope.get("path", "")
        status_code: int | None = None

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            elapsed = time.monotonic() - start
            self.logger.exception("%s %s -> error (%.3fs)", method, path, elapsed)
            raise

        elapsed = time.monotonic() - start
        self.logger.info(
            "%s %s -> %s (%.3fs)",
            method,
            path,
            status_code or "-",
            elapsed,
        )


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        init_db()
        initialize_configured_demo_user()
        _log_model_config_sanity()
        yield

    app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/health")
    async def health():
        return {"ok": True}

    app.include_router(auth_router)
    app.include_router(profile_router)
    app.include_router(memory_router)
    app.include_router(learning_router)
    app.include_router(graph_router)
    app.include_router(knowledge_router)
    app.include_router(path_planning_router)
    app.include_router(ppt_router)
    app.include_router(resources_router)
    app.include_router(quiz_router)
    app.include_router(tutor_eval_router)
    app.include_router(video_router)
    app.include_router(voice_admin_router)
    app.include_router(agent_router)
    app.include_router(teacher_router)
    app.include_router(forum_router)
    app.include_router(mcp_router)
    app.include_router(sharing_router)
    app.include_router(info_stream_router)
    app.include_router(num_person_router)
    app.include_router(code_runner_router)
    app.include_router(admin_router)
    return app


app = create_app()
