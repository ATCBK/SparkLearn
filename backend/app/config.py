from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SparkLearn API"
    app_version: str = "1.0.0"
    debug: str = "true"

    spark_app_id: str = ""
    spark_api_key: str = ""
    spark_api_secret: str = ""
    spark_model: str = "lite"
    spark_api_url: str = "wss://spark-api.xf-yun.com/v1.1/chat"
    spark_use_bridge: bool = True
    spark_bridge_exe: Path = ROOT_DIR / "backend" / "bridge" / "bin" / "spark_bridge.exe"

    # Coze (resource generation)
    coze_base_url: str = "https://api.coze.cn"
    coze_api_path_chat: str = "/v3/chat"
    coze_api_token: str = ""
    coze_default_user_id: str = "single_user"
    coze_bot_id_resource_default: str = ""
    coze_bot_id_resource_document: str = ""
    coze_bot_id_resource_mindmap: str = ""
    coze_bot_id_resource_quiz: str = ""
    coze_bot_id_resource_reading: str = ""
    coze_bot_id_resource_code: str = ""

    # iFlytek 智文 PPT
    xfyun_zw_base_url: str = "https://zwapi.xfyun.cn"
    xfyun_zw_app_id: str = ""
    xfyun_zw_api_secret: str = ""
    xfyun_zw_ppt_author: str = "SparkLearn"
    xfyun_zw_timeout_sec: int = 240

    # iFlytek TTS (video narration)
    xf_tts_app_id: str = ""
    xf_tts_api_key: str = ""
    xf_tts_api_secret: str = ""
    xf_tts_base_url: str = "wss://tts-api.xfyun.cn/v2/tts"
    xf_tts_default_voice: str = "xiaoyan"
    xf_tts_max_concurrency: int = 2
    xf_tts_timeout_ms: int = 15000
    xf_tts_text_limit: int = 1000

    # Video creator
    video_creator_enabled: bool = True
    video_default_provider: str = "html_ppt"
    video_ai_enabled: bool = True
    video_ai_provider: str = "openai_compatible"
    video_ai_base_url: str = "https://api.openai.com/v1"
    video_ai_chat_path: str = "/chat/completions"
    video_ai_api_key: str = ""
    video_ai_model: str = ""
    video_ai_agent_url: str = ""
    video_ai_agent_token: str = ""
    video_ai_timeout_sec: int = 45
    video_ai_max_tokens: int = 4096
    video_ai_temperature: float = 0.7
    video_ai_fallback_enabled: bool = True

    # Agent browser settings
    agent_browser_headless: bool = False   # False = 演示模式，浏览器窗口可见
    agent_browser_slow_mo: int = 800       # 毫秒，让操作慢一点方便观看

    single_user_id: str = "single_user"
    cors_origin: str = "http://localhost:3000"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    data_dir: Path = ROOT_DIR / "backend" / "data"
    db_path: Path = ROOT_DIR / "backend" / "data" / "db" / "sparklearn.db"


settings = Settings()
