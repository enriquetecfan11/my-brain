import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client";
import type { GraphFilters, GraphPage } from "../types";

export interface UseGraphOptions extends GraphFilters {
  projectName: string | null;
  limit?: number;
  offset?: number;
}

export function useGraph({
  projectName,
  limit = 500,
  offset = 0,
  label,
  filePathPrefix,
}: UseGraphOptions) {
  const [graph, setGraph] = useState<GraphPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    if (!projectName) {
      setGraph(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (label) params.set("label", label);
      if (filePathPrefix) params.set("filePathPrefix", filePathPrefix);

      const data = await apiGet<GraphPage>(
        `/api/projects/${encodeURIComponent(projectName)}/graph?${params}`,
      );
      setGraph(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
      setGraph(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectName, limit, offset, label, filePathPrefix]);

  useEffect(() => {
    void fetchGraph();
  }, [fetchGraph]);

  return { graph, isLoading, error, refresh: fetchGraph };
}
