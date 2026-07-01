import { GraphPage } from "./GraphPage";

interface GraphPanelProps {
  projectName: string | null;
  onAskInChat?: (message: string) => void;
}

export function GraphPanel({ projectName, onAskInChat }: GraphPanelProps) {
  return <GraphPage projectName={projectName} onAskInChat={onAskInChat} />;
}
