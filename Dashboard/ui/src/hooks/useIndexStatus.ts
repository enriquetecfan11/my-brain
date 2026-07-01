import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../api/client";
import type { IndexStatusResponse, StartIndexRequest, StartIndexResponse } from "../types";

export function useIndexStatus(onJobsFinished?: () => void) {
  const [jobs, setJobs] = useState<IndexStatusResponse["jobs"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const hadRunningRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet<IndexStatusResponse>("/api/index-status");
      setJobs(data.jobs);
      setError(null);

      const running = data.jobs.some((j) => j.status === "running");
      if (hadRunningRef.current && !running) {
        onJobsFinished?.();
      }
      hadRunningRef.current = running;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load index status");
    }
  }, [onJobsFinished]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(id);
  }, [refresh]);

  const startIndex = useCallback(
    async (body: StartIndexRequest) => {
      setIsStarting(true);
      setError(null);
      try {
        await apiPost<StartIndexResponse>("/api/index", body);
        hadRunningRef.current = true;
        await refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to start indexing";
        setError(msg);
        throw err;
      } finally {
        setIsStarting(false);
      }
    },
    [refresh],
  );

  return { jobs, error, isStarting, startIndex, refresh };
}
