import { useEffect, useRef, useState } from "react";
import { aiChat } from "../api/ai";
import type { ChatMessage } from "../api/ai";
import Markdown from "../components/ui/Markdown";

interface DisplayMessage {
  role: "user" | "assistant" | "error";
  content: string;
  provider?: string;
  model?: string;
}

const SUGGESTIONS = [
  "Why is my CPU usage high right now?",
  "What's consuming the most disk space?",
  "How do I check which ports are open?",
  "What does load average mean and is mine ok?",
  "How can I free up memory on this server?",
];

export default function AiChatPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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

      const res = await aiChat(history);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: res.reply,
        provider: res.provider,
        model: res.model,
      }]);
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

  return (
    <div className="flex flex-col h-full p-4 md:p-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold">AI Server Assistant</h1>
          <p className="text-xs text-slate-500 mt-0.5">Ask anything about your server. Answers include live metrics context.</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="btn-ghost text-xs"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Message list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400 text-center mt-8">Suggestions:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
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
              {m.role === "assistant"
                ? <Markdown>{m.content}</Markdown>
                : <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
              }
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
          placeholder="Ask about your server… (Enter to send, Shift+Enter for newline)"
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
