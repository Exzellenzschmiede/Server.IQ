from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    system_prompt: str | None = None


class ChatResponse(BaseModel):
    reply: str
    provider: str
    model: str


class AnalyzeLogsRequest(BaseModel):
    logs: str
    context: str | None = None


class AnalyzeLogsResponse(BaseModel):
    analysis: str
    provider: str
    model: str


class CronHelpRequest(BaseModel):
    description: str


class CronHelpResponse(BaseModel):
    expression: str
    explanation: str
    provider: str
    model: str


class AgentExecutionResult(BaseModel):
    command: str
    stdout: str
    stderr: str
    exit_code: int


class AgentRequest(BaseModel):
    messages: list[ChatMessage]


class AgentResponse(BaseModel):
    reply: str
    executions: list[AgentExecutionResult]
    provider: str
    model: str


PROVIDER_MODELS: dict[str, list[str]] = {
    "anthropic": [
        "claude-opus-4-7",
        "claude-sonnet-4-6",
        "claude-haiku-4-5-20251001",
    ],
    "openai": [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-3.5-turbo",
    ],
    "mistral": [
        "mistral-large-latest",
        "mistral-small-latest",
        "open-mistral-7b",
    ],
    "gemini": [
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
    ],
}
