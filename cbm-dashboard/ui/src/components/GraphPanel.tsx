import { GraphPage } from "./GraphPage";

interface GraphPanelProps {
  projectName: string | null;
}

export function GraphPanel({ projectName }: GraphPanelProps) {
  return <GraphPage projectName={projectName} />;
}
