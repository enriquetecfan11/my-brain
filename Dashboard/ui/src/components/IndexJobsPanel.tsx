import type { IndexJob } from "../types";

interface IndexJobsPanelProps {
  jobs: IndexJob[];
}

function statusLabel(status: IndexJob["status"]): string {
  switch (status) {
    case "running":
      return "Indexing…";
    case "done":
      return "Done";
    case "error":
      return "Error";
    default:
      return status;
  }
}

export function IndexJobsPanel({ jobs }: IndexJobsPanelProps) {
  if (jobs.length === 0) return null;

  return (
    <section className="index-jobs">
      <h3>Indexing jobs</h3>
      <ul>
        {jobs.map((job) => (
          <li key={`${job.slot}-${job.startedAt ?? job.rootPath}`} className={`index-job index-job--${job.status}`}>
            <div className="index-job__header">
              <span className="index-job__status">{statusLabel(job.status)}</span>
              <span className="mono index-job__path">{job.rootPath}</span>
            </div>
            {job.projectName && (
              <div className="index-job__meta">
                Project name: <span className="mono">{job.projectName}</span>
              </div>
            )}
            {job.status === "error" && job.error && (
              <p className="status status--error">{job.error}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
