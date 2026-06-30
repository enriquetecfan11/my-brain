import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../api/client";
import { useChatConfig } from "../hooks/useChatConfig";
import { useProjects } from "../hooks/useProjects";
import { useSchema } from "../hooks/useSchema";
import type { ChatMessage, ChatModelsResponse, ChatRequest, ChatResponse } from "../types";

interface ChatPanelProps {
  projectName: string | null;
  seedMessage?: string | null;
  onSeedConsumed?: () => void;
}

function pickDefaultModel(models: ChatModelsResponse["models"]): string {
  const withTools = models.filter((m) => m.supportsTools);
  return (withTools[0] ?? models[0])?.name ?? "";
}

export function ChatPanel({ projectName, seedMessage, onSeedConsumed }: ChatPanelProps) {
  const { config, updateConfig, resetConfig } = useChatConfig();
  const { projects } = useProjects();
  const { schema } = useSchema(projectName);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [availableModels, setAvailableModels] = useState<ChatModelsResponse["models"]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const seedHandledRef = useRef<string | null>(null);

  const loadModels = useCallback(async (ollamaUrl: string) => {
    try {
      const params = new URLSearchParams({ ollamaUrl });
      const res = await apiGet<ChatModelsResponse>(`/api/chat/models?${params}`);
      setAvailableModels(res.models);
      setModelsError(null);

      const names = new Set(res.models.map((m) => m.name));
      if (!config.model || !names.has(config.model)) {
        const fallback = pickDefaultModel(res.models);
        if (fallback) updateConfig({ model: fallback });
      }
    } catch (err) {
      setAvailableModels([]);
      setModelsError(err instanceof Error ? err.message : "Failed to load models");
    }
  }, [config.model, updateConfig]);

  useEffect(() => {
    void loadModels(config.ollamaUrl);
  }, [config.ollamaUrl, loadModels]);

  useEffect(() => {
    setMessages([]);
    setError(null);
    seedHandledRef.current = null;
  }, [projectName]);

  const projectMeta = projects.find((p) => p.name === projectName);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !projectName || isLoading) return;

      const userMsg: ChatMessage = { role: "user", content: trimmed };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput("");
      setError(null);
      setIsLoading(true);

      try {
        const body: ChatRequest = {
          projectName,
          messages: nextMessages,
          config,
        };
        const res = await apiPost<ChatResponse>("/api/chat", body);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.message.content },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Chat request failed";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [projectName, messages, config, isLoading],
  );

  useEffect(() => {
    if (!seedMessage || !projectName) return;
    if (seedHandledRef.current === seedMessage) return;
    seedHandledRef.current = seedMessage;
    void sendMessage(seedMessage);
    onSeedConsumed?.();
  }, [seedMessage, projectName, sendMessage, onSeedConsumed]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    seedHandledRef.current = null;
  };

  if (!projectName) {
    return (
      <div className="panel chat-panel">
        <p className="status">Select a project on the Projects tab first.</p>
      </div>
    );
  }

  return (
    <div className="panel chat-panel">
      <div className="chat-panel__header">
        <div>
          <h2>Chat</h2>
          <p className="chat-panel__subtitle">
            Ask questions about <span className="mono">{projectName}</span> using a local Ollama model.
          </p>
        </div>
        <div className="chat-panel__header-actions">
          <button type="button" onClick={() => setShowSettings((v) => !v)}>
            {showSettings ? "Hide settings" : "Settings"}
          </button>
          <button type="button" onClick={clearChat} disabled={messages.length === 0}>
            Clear
          </button>
        </div>
      </div>

      {schema && (
        <div className="chat-context">
          <span className="chat-context__label">Project context</span>
          <div className="chat-context__stats">
            <span>{schema.totalNodes.toLocaleString()} nodes</span>
            <span>{schema.totalEdges.toLocaleString()} edges</span>
            {projectMeta?.path && (
              <span className="mono" title={projectMeta.path}>
                {projectMeta.path}
              </span>
            )}
          </div>
          <div className="chat-context__tags">
            {schema.nodeLabels.slice(0, 8).map((l) => (
              <span key={l.label} className="chat-context__tag">
                {l.label} ({l.count})
              </span>
            ))}
            {schema.nodeLabels.length > 8 && (
              <span className="chat-context__tag">+{schema.nodeLabels.length - 8} more</span>
            )}
          </div>
        </div>
      )}

      {showSettings && (
        <form
          className="chat-settings"
          onSubmit={(e) => {
            e.preventDefault();
            setShowSettings(false);
          }}
        >
          <label>
            Ollama URL
            <input
              type="url"
              value={config.ollamaUrl}
              onChange={(e) => updateConfig({ ollamaUrl: e.target.value })}
              placeholder="http://localhost:11434"
            />
          </label>
          <label>
            Model
            {availableModels.length > 0 ? (
              <select
                value={config.model}
                onChange={(e) => updateConfig({ model: e.target.value })}
              >
                {!config.model && <option value="">Select a model…</option>}
                {availableModels.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                    {m.supportsTools ? "" : " (no tools)"}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={config.model}
                onChange={(e) => updateConfig({ model: e.target.value })}
                placeholder="e.g. ornith:9b"
              />
            )}
          </label>
          {modelsError && <p className="status status--error">{modelsError}</p>}
          <label>
            Max tool iterations
            <input
              type="number"
              min={1}
              max={20}
              value={config.maxToolIterations}
              onChange={(e) =>
                updateConfig({
                  maxToolIterations: Math.min(
                    20,
                    Math.max(1, Number.parseInt(e.target.value, 10) || 8),
                  ),
                })
              }
            />
          </label>
          <div className="chat-settings__actions">
            <button type="button" onClick={() => void loadModels(config.ollamaUrl)}>
              Refresh models
            </button>
            <button type="button" onClick={resetConfig}>
              Reset defaults
            </button>
            <button type="submit">Save</button>
          </div>
        </form>
      )}

      <div className="chat-messages" role="log" aria-live="polite">
        {messages.length === 0 && !isLoading && (
          <p className="chat-messages__empty">
            Ask about architecture, dependencies, or specific symbols in{" "}
            <span className="mono">{projectName}</span>. The assistant already knows the
            project schema and will query the graph with tools when needed.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={`${msg.role}-${i}`}
            className={`chat-message chat-message--${msg.role}`}
          >
            <span className="chat-message__role">
              {msg.role === "user" ? "You" : "Assistant"}
            </span>
            <div className="chat-message__content">{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message chat-message--assistant chat-message--loading">
            <span className="chat-message__role">Assistant</span>
            <div className="chat-message__content">Thinking…</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && <p className="status status--error">{error}</p>}

      <form className="chat-input" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the codebase graph…"
          rows={2}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage(input);
            }
          }}
        />
        <button type="submit" disabled={isLoading || !input.trim() || !config.model}>
          Send
        </button>
      </form>
    </div>
  );
}
