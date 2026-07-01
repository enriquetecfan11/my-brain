import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client";
import type { ProjectSummary, ProjectsResponse } from "../types";

export function useProjects() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<ProjectsResponse>("/api/projects");
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  return { projects, isLoading, error, refresh: fetchProjects };
}
