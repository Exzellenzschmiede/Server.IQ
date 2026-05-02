from pydantic import BaseModel


class VHostCreate(BaseModel):
    domain: str
    root_path: str = ""
    vhost_type: str = "static"   # static | php | proxy
    php_version: str = "8.3"
    proxy_pass: str = ""


class VHostOut(BaseModel):
    domain: str
    root_path: str
    vhost_type: str
    php_version: str
    proxy_pass: str
    enabled: bool
    ssl: bool
    config_path: str


class VHostConfigUpdate(BaseModel):
    config: str


class SSLResult(BaseModel):
    success: bool
    output: str
