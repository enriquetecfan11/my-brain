import { useSchema } from "../hooks/useSchema";

interface SchemaPanelProps {
  projectName: string | null;
}

export function SchemaPanel({ projectName }: SchemaPanelProps) {
  const { schema, isLoading, error, refresh } = useSchema(projectName);

  if (!projectName) {
    return <p className="status">Select a project on the Projects tab first.</p>;
  }

  if (isLoading) {
    return <p className="status">Loading schema for {projectName}…</p>;
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

  if (!schema) {
    return null;
  }

  return (
    <section className="panel">
      <div className="panel__toolbar">
        <h2>Schema — {schema.project}</h2>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="schema-summary">
        <div className="stat-card">
          <span className="stat-card__label">Total nodes</span>
          <span className="stat-card__value">{schema.totalNodes.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Total edges</span>
          <span className="stat-card__value">{schema.totalEdges.toLocaleString()}</span>
        </div>
      </div>

      <div className="schema-grid">
        <div>
          <h3>Node labels</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {schema.nodeLabels.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Edge types</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {schema.edgeTypes.map((row) => (
                <tr key={row.type}>
                  <td>{row.type}</td>
                  <td>{row.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
