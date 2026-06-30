import { useProjects } from "../hooks/useProjects";

interface ProjectsPanelProps {
  selectedProject: string | null;
  onSelectProject: (name: string) => void;
}

export function ProjectsPanel({ selectedProject, onSelectProject }: ProjectsPanelProps) {
  const { projects, isLoading, error, refresh } = useProjects();

  if (isLoading) {
    return <p className="status">Loading projects…</p>;
  }

  if (error) {
    return (
      <div className="status status--error">
        <p>{error}</p>
        <button type="button" onClick={() => void refresh()}>
          Retry
        </button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <p className="status">
        No indexed projects found. Run <code>codebase-memory-mcp cli index_repository</code>{" "}
        first.
      </p>
    );
  }

  return (
    <section className="panel">
      <div className="panel__toolbar">
        <h2>Indexed projects</h2>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Path</th>
            <th>Indexed at</th>
            <th>Nodes</th>
            <th>Edges</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.name}
              className={selectedProject === project.name ? "data-table__row--selected" : ""}
            >
              <td>{project.name}</td>
              <td className="mono">{project.path || "—"}</td>
              <td>{project.indexedAt ?? "—"}</td>
              <td>{project.nodeCount.toLocaleString()}</td>
              <td>{project.edgeCount.toLocaleString()}</td>
              <td>
                <button type="button" onClick={() => onSelectProject(project.name)}>
                  {selectedProject === project.name ? "Selected" : "Select"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
