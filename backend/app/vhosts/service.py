import os
import re
import subprocess
from pathlib import Path

SITES_AVAILABLE = Path("/etc/nginx/sites-available")
SITES_ENABLED = Path("/etc/nginx/sites-enabled")


def _nginx_test() -> tuple[bool, str]:
    r = subprocess.run(["nginx", "-t"], capture_output=True, text=True, timeout=10)
    return r.returncode == 0, r.stderr


def _nginx_reload() -> None:
    subprocess.run(["nginx", "-s", "reload"], check=True, timeout=10)


def _parse_config(content: str) -> dict:
    root_m = re.search(r"^\s*root\s+([^\s;]+)", content, re.MULTILINE)
    proxy_m = re.search(r"proxy_pass\s+([^\s;]+)", content)
    ssl = bool(re.search(r"listen\s+443", content))
    php_m = re.search(r"php(\d+\.\d+)-fpm\.sock", content)
    return {
        "root_path": root_m.group(1) if root_m else "",
        "ssl": ssl,
        "proxy_pass": proxy_m.group(1) if proxy_m else "",
        "php_version": php_m.group(1) if php_m else "8.3",
        "vhost_type": "proxy" if proxy_m else ("php" if php_m else "static"),
    }


def list_vhosts() -> list[dict]:
    if not SITES_AVAILABLE.exists():
        return []
    result = []
    for conf in sorted(SITES_AVAILABLE.iterdir()):
        if not conf.is_file():
            continue
        try:
            content = conf.read_text()
            parsed = _parse_config(content)
            enabled = (SITES_ENABLED / conf.name).is_symlink() or (SITES_ENABLED / conf.name).exists()
            is_default = conf.name == "default"
            result.append({
                "domain": conf.stem,
                "enabled": enabled,
                "config_path": str(conf),
                "is_default": is_default,
                **parsed,
            })
        except Exception:
            pass
    return result


def _generate_config(domain: str, root_path: str, vhost_type: str, php_version: str, proxy_pass: str) -> str:
    if vhost_type == "proxy":
        return (
            f"server {{\n"
            f"    listen 80;\n"
            f"    server_name {domain};\n\n"
            f"    location / {{\n"
            f"        proxy_pass {proxy_pass};\n"
            f"        proxy_http_version 1.1;\n"
            f"        proxy_set_header Upgrade $http_upgrade;\n"
            f"        proxy_set_header Connection 'upgrade';\n"
            f"        proxy_set_header Host $host;\n"
            f"        proxy_set_header X-Real-IP $remote_addr;\n"
            f"        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
            f"        proxy_cache_bypass $http_upgrade;\n"
            f"    }}\n"
            f"}}\n"
        )
    if vhost_type == "php":
        return (
            f"server {{\n"
            f"    listen 80;\n"
            f"    server_name {domain};\n"
            f"    root {root_path};\n"
            f"    index index.php index.html index.htm;\n\n"
            f"    location / {{\n"
            f"        try_files $uri $uri/ /index.php?$query_string;\n"
            f"    }}\n\n"
            f"    location ~ \\.php$ {{\n"
            f"        include snippets/fastcgi-php.conf;\n"
            f"        fastcgi_pass unix:/run/php/php{php_version}-fpm.sock;\n"
            f"    }}\n\n"
            f"    location ~ /\\.ht {{\n"
            f"        deny all;\n"
            f"    }}\n"
            f"}}\n"
        )
    # static
    return (
        f"server {{\n"
        f"    listen 80;\n"
        f"    server_name {domain};\n"
        f"    root {root_path};\n"
        f"    index index.html index.htm;\n\n"
        f"    location / {{\n"
        f"        try_files $uri $uri/ =404;\n"
        f"    }}\n"
        f"}}\n"
    )


def create_vhost(domain: str, root_path: str, vhost_type: str, php_version: str, proxy_pass: str) -> dict:
    conf_path = SITES_AVAILABLE / f"{domain}.conf"
    if conf_path.exists():
        raise ValueError(f"vHost '{domain}' already exists")
    SITES_AVAILABLE.mkdir(parents=True, exist_ok=True)
    if vhost_type != "proxy" and root_path:
        os.makedirs(root_path, exist_ok=True)
    conf_path.write_text(_generate_config(domain, root_path, vhost_type, php_version, proxy_pass))
    SITES_ENABLED.mkdir(parents=True, exist_ok=True)
    link = SITES_ENABLED / f"{domain}.conf"
    if not link.exists():
        link.symlink_to(conf_path)
    ok, msg = _nginx_test()
    if not ok:
        conf_path.unlink(missing_ok=True)
        link.unlink(missing_ok=True)
        raise RuntimeError(f"nginx config test failed: {msg}")
    _nginx_reload()
    return {"domain": domain, "root_path": root_path, "vhost_type": vhost_type,
            "php_version": php_version, "proxy_pass": proxy_pass, "enabled": True,
            "ssl": False, "config_path": str(conf_path)}


def delete_vhost(domain: str) -> None:
    (SITES_ENABLED / f"{domain}.conf").unlink(missing_ok=True)
    (SITES_AVAILABLE / f"{domain}.conf").unlink(missing_ok=True)
    try:
        _nginx_reload()
    except Exception:
        pass


def toggle_vhost(domain: str, enabled: bool) -> None:
    conf_path = SITES_AVAILABLE / f"{domain}.conf"
    link = SITES_ENABLED / f"{domain}.conf"
    if enabled:
        if not link.exists():
            link.symlink_to(conf_path)
    else:
        link.unlink(missing_ok=True)
    ok, msg = _nginx_test()
    if not ok:
        if enabled:
            link.unlink(missing_ok=True)
        else:
            link.symlink_to(conf_path)
        raise RuntimeError(f"nginx test failed: {msg}")
    _nginx_reload()


def get_vhost_config(domain: str) -> str:
    conf_path = SITES_AVAILABLE / f"{domain}.conf"
    if not conf_path.exists():
        raise FileNotFoundError(f"No config for '{domain}'")
    return conf_path.read_text()


def update_vhost_config(domain: str, config: str) -> None:
    conf_path = SITES_AVAILABLE / f"{domain}.conf"
    backup = conf_path.read_text() if conf_path.exists() else ""
    conf_path.write_text(config)
    ok, msg = _nginx_test()
    if not ok:
        conf_path.write_text(backup)
        raise RuntimeError(f"nginx test failed: {msg}")
    _nginx_reload()


def enable_ssl(domain: str) -> tuple[bool, str]:
    r = subprocess.run(
        ["certbot", "--nginx", "-d", domain, "--non-interactive",
         "--agree-tos", "--register-unsafely-without-email"],
        capture_output=True, text=True, timeout=120,
    )
    return r.returncode == 0, (r.stdout + r.stderr).strip()
