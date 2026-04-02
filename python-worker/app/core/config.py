from pydantic_settings import BaseSettings, SettingsConfigDict

# Deve coincidir com nestjs-api/src/videos/videos.service.ts (TRANSCRIBE_QUEUE_KEY)
TRANSCRIBE_QUEUE_KEY = "transcribe:jobs"


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

    # --- Redis (fila de transcrição) ---
    redis_url: str = "redis://localhost:6379"
    transcribe_queue_key: str = TRANSCRIBE_QUEUE_KEY

    # --- RabbitMQ ---
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"

    # --- Transcrição: stub | local | gemini | api (OpenAI whisper-1) ---
    transcribe_mode: str = "stub"
    transcribe_gemini_model: str = ""  # vazio: usa ai_model ou gemini-2.5-flash
    whisper_model: str = "base"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"


settings = Settings()
