from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    RABBITMQ_URL: str = "amqp://guest:guest@rabbitmq:5672/"
    POSTGRES_READ_URL: str
    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.5-flash"
    MAX_AGENT_RETRIES: int = 3
    AGENT_RETRY_BASE_DELAY: float = 1.0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
