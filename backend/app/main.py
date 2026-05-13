import asyncio
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .routes.learning import router as learning_router
from .routes.knowledge import router as knowledge_router
from .routes.path_planning import router as path_planning_router
from .routes.ppt import router as ppt_router
from .routes.profile import router as profile_router
from .routes.quiz import router as quiz_router
from .routes.resources import router as resources_router
from .routes.tutor_eval import router as tutor_eval_router
from .routes.video import router as video_router
from .routes.voice_admin import router as voice_admin_router


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


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version=settings.app_version)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.cors_origin, "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def on_startup() -> None:
        init_db()

    @app.get("/health")
    async def health():
        return {"ok": True}

    app.include_router(profile_router)
    app.include_router(learning_router)
    app.include_router(knowledge_router)
    app.include_router(path_planning_router)
    app.include_router(ppt_router)
    app.include_router(resources_router)
    app.include_router(quiz_router)
    app.include_router(tutor_eval_router)
    app.include_router(video_router)
    app.include_router(voice_admin_router)
    return app


app = create_app()
