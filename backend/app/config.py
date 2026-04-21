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

    single_user_id: str = "single_user"
    cors_origin: str = "http://localhost:3000"

    data_dir: Path = ROOT_DIR / "backend" / "data"
    db_path: Path = ROOT_DIR / "backend" / "data" / "db" / "sparklearn.db"


settings = Settings()
