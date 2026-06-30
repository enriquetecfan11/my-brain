import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client";
import type { GraphSchema } from "../types";

export function useSchema(projectName: string | null) {
  const [schema, setSchema] = useState<GraphSchema | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchema = useCallback(async () => {
    if (!projectName) {
      setSchema(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<GraphSchema>(
        `/api/projects/${encodeURIComponent(projectName)}/schema`,
      );
      setSchema(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schema");
      setSchema(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectName]);

  useEffect(() => {
    void fetchSchema();
  }, [fetchSchema]);

  return { schema, isLoading, error, refresh: fetchSchema };
}
