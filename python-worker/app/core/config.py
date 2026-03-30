from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    media_root: str = "/app/media"

    # --- AI provider ---
    # "openai" or "gemini"
    ai_provider: str = "gemini"
    openai_api_key: str = ""
    gemini_api_key: str = ""
    ai_model: str = ""  # deixar vazio usa default do provider

    # --- Database ---
    database_url: str = "postgresql://user:pass@db:5432/db"


settings = Settings()
