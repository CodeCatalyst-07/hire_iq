from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database
    database_url: str

    # Supabase
    supabase_url: str
    supabase_service_role_key: str

    # Gemini
    gemini_api_key: str
    gemini_model: str = "gemini-1.5-flash"

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # App
    frontend_url: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    max_file_size_mb: int = 10


settings = Settings()
