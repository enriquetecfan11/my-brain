/** Shared node-label palette used by GraphView and NodeDetail. */
export const LABEL_COLORS: Record<string, string> = {
  Function: "#3b82f6",
  Class: "#8b5cf6",
  Method: "#06b6d4",
  Module: "#22c55e",
  File: "#f59e0b",
  Interface: "#ec4899",
  Variable: "#64748b",
  Route: "#f97316",
  Endpoint: "#f97316",
};

export const DEFAULT_LABEL_COLOR = "#94a3b8";

export function colorForLabel(label: string): string {
  return LABEL_COLORS[label] ?? DEFAULT_LABEL_COLOR;
}
