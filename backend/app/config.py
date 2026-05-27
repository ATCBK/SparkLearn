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
    spark_api_url: str = "wss://maas-api.cn-huabei-1.xf-yun.com/v1.1/chat"
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
    # 发音人列表: aisxping(温柔女声) aisjinger(活泼女声) aisjiuxu(男声) xiaoyan(标准女声)
    xf_tts_app_id: str = ""
    xf_tts_api_key: str = ""
    xf_tts_api_secret: str = ""
    xf_tts_base_url: str = "wss://tts-api.xfyun.cn/v2/tts"
    xf_tts_default_voice: str = "aisxping"
    xf_tts_speed: int = 45       # 语速 0-100, 默认50
    xf_tts_pitch: int = 50       # 音调 0-100
    xf_tts_volume: int = 65      # 音量 0-100
    xf_tts_sample_rate: int = 16000  # 采样率 8000/16000
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
    video_ai_fallback_enabled: bool = False

    # Video style presets for multi-style AI generation
    video_styles: dict = {
        "apple-minimal": {
            "id": "apple-minimal",
            "name": "苹果极简风",
            "description": "白底+蓝色点缀，系统化技术教学",
            "accent_color": "#0071e3",
            "bg_gradient": "linear-gradient(135deg, #ffffff 0%, #e8f7ff 48%, #f7f3ff 100%)",
            "font_family": '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
            "code_bg": "#1d1d1f",
            "code_color": "#f5f5f7",
            "card_bg": "rgba(255,255,255,.74)",
            "tone": "简洁、现代、克制，像 Apple 官网风格",
        },
        "dark-tech": {
            "id": "dark-tech",
            "name": "暗色科技风",
            "description": "深色+霓虹青绿，进阶编程内容",
            "accent_color": "#00e5a0",
            "bg_gradient": "linear-gradient(135deg, #0a0e17 0%, #111827 48%, #0d1b2a 100%)",
            "font_family": '"JetBrains Mono", "Cascadia Code", Consolas, "Microsoft YaHei", monospace',
            "code_bg": "#030712",
            "code_color": "#00e5a0",
            "card_bg": "rgba(17,24,39,.92)",
            "tone": "科技感、黑客风格，代码驱动讲解",
        },
        "warm-education": {
            "id": "warm-education",
            "name": "温暖教育风",
            "description": "柔和暖色+圆润卡片，入门教学、少儿编程",
            "accent_color": "#f59e0b",
            "bg_gradient": "linear-gradient(135deg, #fefce8 0%, #fff7ed 48%, #fef3c7 100%)",
            "font_family": '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
            "code_bg": "#292524",
            "code_color": "#fef3c7",
            "card_bg": "rgba(255,252,240,.88)",
            "tone": "温暖、耐心、鼓励式，适合初学者和少儿",
        },
        "business-pro": {
            "id": "business-pro",
            "name": "商务专业风",
            "description": "深蓝基调+金色点缀，企业培训、报告",
            "accent_color": "#d4a853",
            "bg_gradient": "linear-gradient(135deg, #0c1929 0%, #152238 48%, #0f1f3a 100%)",
            "font_family": '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif',
            "code_bg": "#020617",
            "code_color": "#e2e8f0",
            "card_bg": "rgba(21,34,56,.94)",
            "tone": "专业、权威、结构化，适合企业培训",
        },
        "cartoon-playful": {
            "id": "cartoon-playful",
            "name": "趣味卡通风",
            "description": "多彩渐变+大圆角，少儿编程、零基础",
            "accent_color": "#8b5cf6",
            "bg_gradient": "linear-gradient(135deg, #faf5ff 0%, #ede9fe 25%, #fce7f3 55%, #e0e7ff 100%)",
            "font_family": '"PingFang SC", "Noto Sans SC", "Comic Sans MS", cursive, sans-serif',
            "code_bg": "#2d1b69",
            "code_color": "#e9d5ff",
            "card_bg": "rgba(255,255,255,.82)",
            "tone": "活泼、有趣、游戏化，卡片圆润、色彩丰富",
        },
        "academic": {
            "id": "academic",
            "name": "学术典雅风",
            "description": "米色底色+衬线字体，大学课程、深度专题",
            "accent_color": "#8b2500",
            "bg_gradient": "linear-gradient(135deg, #fdfbf7 0%, #f7f3e8 48%, #faf6ee 100%)",
            "font_family": '"Noto Serif SC", "STSong", "SimSun", Georgia, serif',
            "code_bg": "#2c2420",
            "code_color": "#f5e6d3",
            "card_bg": "rgba(253,251,247,.90)",
            "tone": "学术、严谨、深度，适合大学课程和专题研究",
        },
    }

    # Agent browser settings
    agent_browser_headless: bool = False   # False = 演示模式，浏览器窗口可见
    agent_browser_slow_mo: int = 800       # 毫秒，让操作慢一点方便观看

    single_user_id: str = "single_user"
    use_mock_data: bool = True
    cors_origin: str = "http://localhost:3000"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    data_dir: Path = ROOT_DIR / "backend" / "data"
    db_path: Path = ROOT_DIR / "backend" / "data" / "db" / "sparklearn.db"


settings = Settings()
