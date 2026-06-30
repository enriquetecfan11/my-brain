import { useCallback, useEffect, useState } from "react";
import type { ChatConfig } from "../types";

const STORAGE_KEY = "cbm-chat-config";

const DEFAULTS: ChatConfig = {
  ollamaUrl: "http://localhost:11434",
  model: "",
  maxToolIterations: 8,
};

function loadFromStorage(): ChatConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<ChatConfig>;
    return {
      ollamaUrl: parsed.ollamaUrl?.trim() || DEFAULTS.ollamaUrl,
      model: parsed.model?.trim() || DEFAULTS.model,
      maxToolIterations:
        typeof parsed.maxToolIterations === "number" && parsed.maxToolIterations > 0
          ? Math.min(parsed.maxToolIterations, 20)
          : DEFAULTS.maxToolIterations,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function useChatConfig() {
  const [config, setConfig] = useState<ChatConfig>(loadFromStorage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const updateConfig = useCallback((patch: Partial<ChatConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig({ ...DEFAULTS });
  }, []);

  return { config, updateConfig, resetConfig };
}
