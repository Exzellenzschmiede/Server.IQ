from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    postgres_host: str = "172.17.0.1"
    postgres_port: int = 5432
    postgres_db: str = "server_iq"
    postgres_user: str
    postgres_password: str

    cors_origins: list[str] = ["http://localhost:8101"]

    # VPS console — SSH from backend container to the host
    console_ssh_host: str = "host.docker.internal"
    console_ssh_port: int = 22
    console_ssh_user: str = "deploy"
    console_ssh_key_b64: str = ""  # base64 -w0 ~/.ssh/id_ed25519

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
