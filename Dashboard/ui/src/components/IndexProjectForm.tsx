import { useState } from "react";
import { FolderPicker } from "./FolderPicker";
import type { IndexMode } from "../types";

interface IndexProjectFormProps {
  isStarting: boolean;
  onStart: (input: { rootPath: string; projectName?: string; mode: IndexMode }) => Promise<void>;
}

export function IndexProjectForm({ isStarting, onStart }: IndexProjectFormProps) {
  const [rootPath, setRootPath] = useState("");
  const [projectName, setProjectName] = useState("");
  const [mode, setMode] = useState<IndexMode>("full");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = rootPath.trim();
    if (!trimmed) {
      setFormError("Select a repository folder first");
      return;
    }
    setFormError(null);
    try {
      await onStart({
        rootPath: trimmed,
        projectName: projectName.trim() || undefined,
        mode,
      });
      setRootPath("");
      setProjectName("");
    } catch {
      // error surfaced by parent hook
    }
  };

  return (
    <form className="index-form" onSubmit={(e) => void handleSubmit(e)}>
      <h3>Index a repository</h3>
      <p className="index-form__hint">
        Choose a local folder to index with{" "}
        <code className="mono">codebase-memory-mcp</code>. Set{" "}
        <code className="mono">CBM_BINARY</code> if the CLI is not on PATH.
      </p>
      <div className="index-form__grid">
        <FolderPicker value={rootPath} onChange={setRootPath} disabled={isStarting} />
        <label>
          Project name (optional)
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="defaults to folder name"
            disabled={isStarting}
          />
        </label>
        <label>
          Mode
          <select value={mode} onChange={(e) => setMode(e.target.value as IndexMode)} disabled={isStarting}>
            <option value="full">full</option>
            <option value="moderate">moderate</option>
            <option value="fast">fast</option>
          </select>
        </label>
      </div>
      {formError && <p className="status status--error">{formError}</p>}
      <button type="submit" disabled={isStarting || !rootPath.trim()}>
        {isStarting ? "Starting…" : "Start indexing"}
      </button>
    </form>
  );
}
