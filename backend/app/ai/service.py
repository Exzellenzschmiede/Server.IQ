import json

import httpx
from fastapi import HTTPException, status

from .schemas import ChatMessage

_TIMEOUT = 60.0


async def _call_anthropic(api_key: str, model: str, system: str, messages: list[ChatMessage]) -> str:
    payload = {
        "model": model,
        "max_tokens": 2048,
        "messages": [{"role": m.role, "content": m.content} for m in messages],
    }
    if system:
        payload["system"] = system
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )
    if r.status_code != 200:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"Anthropic API error: {r.text[:300]}")
    return r.json()["content"][0]["text"]


async def _call_openai_compat(base_url: str, api_key: str, model: str, system: str, messages: list[ChatMessage]) -> str:
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs += [{"role": m.role, "content": m.content} for m in messages]
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
            json={"model": model, "messages": msgs, "max_tokens": 2048},
        )
    if r.status_code != 200:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"API error: {r.text[:300]}")
    return r.json()["choices"][0]["message"]["content"]


async def _call_gemini(api_key: str, model: str, system: str, messages: list[ChatMessage]) -> str:
    contents = []
    if system:
        contents.append({"role": "user", "parts": [{"text": f"[System instructions]\n{system}"}]})
        contents.append({"role": "model", "parts": [{"text": "Understood."}]})
    for m in messages:
        role = "user" if m.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m.content}]})
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.post(url, json={"contents": contents})
    if r.status_code != 200:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"Gemini API error: {r.text[:300]}")
    data = r.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


async def call_ai(provider: str, model: str, api_key: str, system: str, messages: list[ChatMessage]) -> str:
    """Dispatch to the correct provider and return the assistant's reply text."""
    try:
        if provider == "anthropic":
            return await _call_anthropic(api_key, model, system, messages)
        elif provider == "openai":
            return await _call_openai_compat("https://api.openai.com/v1", api_key, model, system, messages)
        elif provider == "mistral":
            return await _call_openai_compat("https://api.mistral.ai/v1", api_key, model, system, messages)
        elif provider == "gemini":
            return await _call_gemini(api_key, model, system, messages)
        else:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Unknown provider: {provider}")
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status.HTTP_504_GATEWAY_TIMEOUT, detail="AI provider request timed out")
    except Exception as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"AI provider error: {e}")


def parse_cron_response(text: str) -> tuple[str, str]:
    """Extract cron expression and explanation from AI response."""
    expression = ""
    explanation = text.strip()
    for line in text.splitlines():
        stripped = line.strip()
        # Look for a line that looks like a cron expression (5 or 6 space-separated fields)
        parts = stripped.replace("`", "").strip().split()
        if 5 <= len(parts) <= 6 and all(
            p.replace("*", "").replace("/", "").replace("-", "").replace(",", "").isdigit()
            or p in ("*", "@reboot", "@hourly", "@daily", "@weekly", "@monthly", "@yearly")
            or p.replace("*", "").replace("/", "").replace("-", "").replace(",", "").replace("L", "").replace("W", "").replace("#", "").isdigit()
            for p in parts
        ):
            expression = stripped.replace("`", "").strip()
            break
    # If we couldn't parse it, return raw text
    if not expression:
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        expression = lines[0] if lines else text.strip()
    return expression, explanation
