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

    # DeepSeek API
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"

    # 多模型配置：{模型标识: {provider, url, domain, label}}
    # provider: "spark" 走 WebSocket 星火协议，"deepseek" 走 OpenAI 兼容 HTTP 协议
    spark_model_map: dict = {
        "lite": {"provider": "spark", "url": "wss://spark-api.xf-yun.com/v1.1/chat", "domain": "lite", "label": "Spark Lite"},
        "x1": {"provider": "spark", "url": "wss://spark-api.xf-yun.com/v1/x1", "domain": "spark-x", "label": "Spark X1.5"},
        "x2": {"provider": "spark", "url": "wss://spark-api.xf-yun.com/x2", "domain": "spark-x", "label": "Spark X2"},
        "ds-flash": {"provider": "deepseek", "url": "", "domain": "", "label": "DeepSeek V4 Flash"},
        "ds-pro": {"provider": "deepseek", "url": "", "domain": "", "label": "DeepSeek V4 Pro"},
    }
    spark_default_model: str = "lite"

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
    xf_tts_speed: int = 45
    xf_tts_pitch: int = 50
    xf_tts_volume: int = 65
    xf_tts_sample_rate: int = 16000
    xf_tts_max_concurrency: int = 2
    xf_tts_timeout_ms: int = 15000
    xf_tts_text_limit: int = 1000

    # Aliyun CosyVoice TTS (DashScope)
    cosyvoice_api_key: str = ""
    cosyvoice_model: str = "cosyvoice-v1"
    cosyvoice_default_voice: str = "longxiaochun"
    cosyvoice_format: str = "wav"
    cosyvoice_sample_rate: int = 24000
    cosyvoice_speech_rate: float = 1.0
    cosyvoice_pitch_rate: float = 1.0
    cosyvoice_volume: float = 1.0
    cosyvoice_max_concurrency: int = 2
    cosyvoice_timeout_sec: int = 30
    tts_provider: str = "auto"

    # iFlytek Embedding (HTTP)
    xfyun_emb_base_url: str = "https://emb-cn-huabei-1.xf-yun.com/"
    xfyun_emb_app_id: str = ""
    xfyun_emb_api_key: str = ""
    xfyun_emb_api_secret: str = ""
    xfyun_emb_timeout_sec: int = 20

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
    video_ai_embedding_model: str = ""

    # Tavily 联网搜索
    tavily_api_key: str = ""

    # Agent browser settings
    agent_browser_headless: bool = False   # False = 演示模式，浏览器窗口可见
    agent_browser_slow_mo: int = 800       # 毫秒，让操作慢一点方便观看

    # Unified external API defaults
    api_default_timeout: int = 30
    api_max_retries: int = 2

    # Aliyun SMS and OSS
    aliyun_sms_access_key_id: str = ""
    aliyun_sms_access_key_secret: str = ""
    aliyun_sms_region_id: str = "cn-hangzhou"
    aliyun_sms_endpoint: str = "dypnsapi.aliyuncs.com"
    aliyun_sms_sign_name: str = ""
    aliyun_sms_template_code: str = "100001"
    sms_code_expire_minutes: int = 5
    sms_rate_limit_seconds: int = 60

    aliyun_oss_access_key_id: str = ""
    aliyun_oss_access_key_secret: str = ""
    aliyun_oss_bucket_name: str = ""
    aliyun_oss_endpoint: str = "oss-cn-hangzhou.aliyuncs.com"
    aliyun_oss_cdn_domain: str = ""

    single_user_id: str = "single_user"
    use_mock_data: bool = True
    cors_origin: str = "http://localhost:3000"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    data_dir: Path = ROOT_DIR / "backend" / "data"
    db_path: Path = ROOT_DIR / "backend" / "data" / "db" / "sparklearn.db"

    db_type: str = "sqlite"
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "sparklearn"
    db_user: str = ""
    db_password: str = ""
    db_ssl_mode: str = "prefer"


settings = Settings()
