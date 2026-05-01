import { useEffect, useRef, useState } from "react";
import { aiAgent, aiChat } from "../api/ai";
import type { AgentExecution, ChatMessage } from "../api/ai";
import Markdown from "../components/ui/Markdown";

interface DisplayMessage {
  role: "user" | "assistant" | "error";
  content: string;
  provider?: string;
  model?: string;
  executions?: AgentExecution[];
}

const SUGGESTIONS = [
  "Why is my CPU usage high right now?",
  "What's consuming the most disk space?",
  "How do I check which ports are open?",
  "What does load average mean and is mine ok?",
  "How can I free up memory on this server?",
];

const AGENT_SUGGESTIONS = [
  "Restart the nginx service",
  "Show me all running Docker containers",
  "Check disk usage and clean up if needed",
  "List the 10 largest files under /var",
  "Show recent auth failures from the journal",
];

function ExecutionBlock({ exec }: { exec: AgentExecution }) {
  const [open, setOpen] = useState(true);
  const success = exec.exit_code === 0;
  return (
    <div className="mt-2 rounded-lg border border-slate-600/50 overflow-hidden text-xs font-mono">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-800 transition-colors text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className={success ? "text-emerald-400" : "text-red-400"}>
            {success ? "✓" : "✗"}
          </span>
          <code className="text-slate-300 truncate">{exec.command}</code>
        </span>
        <span className="text-slate-600 shrink-0">{open ? "▾" : "▸"}</span>
      </button>
      {open && (exec.stdout || exec.stderr) && (
        <div className="px-3 py-2 bg-slate-950/60 space-y-1 max-h-48 overflow-y-auto">
          {exec.stdout && (
            <pre className="text-slate-300 whitespace-pre-wrap break-all leading-relaxed">{exec.stdout}</pre>
          )}
          {exec.stderr && (
            <pre className="text-red-400 whitespace-pre-wrap break-all leading-relaxed">{exec.stderr}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function AiChatPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: DisplayMessage = { role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history: ChatMessage[] = [...messages, userMsg]
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      if (agentMode) {
        const res = await aiAgent(history);
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: res.reply,
          provider: res.provider,
          model: res.model,
          executions: res.executions,
        }]);
      } else {
        const res = await aiChat(history);
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: res.reply,
          provider: res.provider,
          model: res.model,
        }]);
      }
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? "AI request failed. Make sure an API key is configured in Settings.";
      setMessages((prev) => [...prev, { role: "error", content: detail }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const suggestions = agentMode ? AGENT_SUGGESTIONS : SUGGESTIONS;

  return (
    <div className="flex flex-col h-full p-4 md:p-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold">AI Server Assistant</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {agentMode
              ? "Agent mode: AI can execute shell commands directly on this server."
              : "Ask anything about your server. Answers include live metrics context."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="btn-ghost text-xs">
              Clear
            </button>
          )}
          <button
            onClick={() => { setAgentMode((v) => !v); setMessages([]); }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              agentMode
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30"
                : "bg-slate-700/40 border-slate-600 text-slate-400 hover:bg-slate-700/70 hover:text-slate-200"
            }`}
          >
            ⚡ Agent {agentMode ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Agent mode warning */}
      {agentMode && (
        <div className="shrink-0 mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>
            Agent mode is active. The AI will execute shell commands on the server as root to fulfill your requests.
            Only use this with trusted inputs.
          </span>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400 text-center mt-8">Suggestions:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-3 py-1.5 text-xs bg-slate-700/50 text-slate-300 rounded-full hover:bg-slate-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              m.role === "user"
                ? "bg-indigo-600/30 text-slate-200 rounded-br-sm"
                : m.role === "error"
                ? "bg-red-600/20 text-red-300 border border-red-500/30 rounded-bl-sm"
                : "bg-slate-700/60 text-slate-200 rounded-bl-sm"
            }`}>
              {m.role === "assistant" ? (
                <>
                  {m.executions && m.executions.length > 0 && (
                    <div className="mb-3 space-y-1">
                      {m.executions.map((ex, j) => (
                        <ExecutionBlock key={j} exec={ex} />
                      ))}
                    </div>
                  )}
                  <Markdown>{m.content}</Markdown>
                </>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
              )}
              {m.role === "assistant" && m.model && (
                <p className="text-[10px] text-slate-500 mt-2">{m.provider} / {m.model}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-700/60 rounded-2xl rounded-bl-sm px-4 py-3">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder={
            agentMode
              ? "Tell the agent what to do… (e.g. Restart nginx, Show top processes)"
              : "Ask about your server… (Enter to send, Shift+Enter for newline)"
          }
          rows={2}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="btn-primary px-4 py-3 shrink-0 disabled:opacity-40"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
