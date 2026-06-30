import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../api/client";
import type { FsListResponse, PickFolderResponse } from "../types";

interface FolderPickerProps {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
}

export function FolderPicker({ value, onChange, disabled }: FolderPickerProps) {
  const [isPicking, setIsPicking] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserPath, setBrowserPath] = useState("");
  const [listing, setListing] = useState<FsListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadListing = useCallback(async (path?: string) => {
    setError(null);
    try {
      const params = path ? `?path=${encodeURIComponent(path)}` : "";
      const data = await apiGet<FsListResponse>(`/api/fs/list${params}`);
      setListing(data);
      setBrowserPath(data.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folders");
      setListing(null);
    }
  }, []);

  useEffect(() => {
    if (!showBrowser) return;
    void loadListing(browserPath || undefined);
    // Only load when the browser panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBrowser]);

  const handleNativePick = async () => {
    setIsPicking(true);
    setError(null);
    try {
      const res = await apiPost<PickFolderResponse>("/api/pick-folder", {});
      if (res.path) {
        onChange(res.path);
        setShowBrowser(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Folder picker failed");
      setShowBrowser(true);
      await loadListing();
    } finally {
      setIsPicking(false);
    }
  };

  const openBrowser = async () => {
    setShowBrowser(true);
    if (!browserPath) {
      const home = await apiGet<{ home: string }>("/api/fs/home");
      setBrowserPath(home.home);
    }
  };

  return (
    <div className="folder-picker">
      <label className="folder-picker__label">
        Repository
        <div className="folder-picker__row">
          <input
            type="text"
            className="folder-picker__path mono"
            value={value}
            readOnly
            placeholder="Select a folder…"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => void handleNativePick()}
            disabled={disabled || isPicking}
          >
            {isPicking ? "Opening…" : "Select folder…"}
          </button>
          <button
            type="button"
            onClick={() => void openBrowser()}
            disabled={disabled}
          >
            Browse
          </button>
        </div>
      </label>

      {error && <p className="status status--error">{error}</p>}

      {showBrowser && (
        <div className="folder-browser">
          <div className="folder-browser__toolbar">
            <span className="mono folder-browser__current">{listing?.path ?? browserPath}</span>
            <button
              type="button"
              onClick={() => onChange(listing?.path ?? browserPath)}
              disabled={!listing?.path && !browserPath}
            >
              Use this folder
            </button>
          </div>
          {listing?.parent && (
            <button
              type="button"
              className="folder-browser__up"
              onClick={() => void loadListing(listing.parent!)}
            >
              ↑ Parent folder
            </button>
          )}
          <ul className="folder-browser__list">
            {(listing?.entries ?? []).map((entry) => (
              <li key={entry.path}>
                <button type="button" onClick={() => void loadListing(entry.path)}>
                  {entry.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
