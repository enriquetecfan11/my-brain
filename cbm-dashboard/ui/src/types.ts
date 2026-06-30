/** GET /api/projects */
export interface ProjectSummary {
  name: string;
  path: string;
  indexedAt: string | null;
  nodeCount: number;
  edgeCount: number;
}

export interface ProjectsResponse {
  projects: ProjectSummary[];
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface EdgeTypeCount {
  type: string;
  count: number;
}

/** GET /api/projects/:name/schema */
export interface GraphSchema {
  project: string;
  totalNodes: number;
  totalEdges: number;
  nodeLabels: LabelCount[];
  edgeTypes: EdgeTypeCount[];
}

/** GET /api/projects/:name/graph */
export interface Node {
  id: number;
  label: string;
  name: string;
  qualifiedName: string;
  filePath: string;
  startLine: number;
  endLine: number;
  properties: Record<string, unknown>;
}

export interface Edge {
  id: number;
  source: number;
  target: number;
  type: string;
  properties: Record<string, unknown>;
}

export interface GraphPageInfo {
  limit: number;
  offset: number;
  nodeCount: number;
  totalNodes: number;
  hasMore: boolean;
}

export interface GraphPage {
  project: string;
  pagination: GraphPageInfo;
  nodes: Node[];
  edges: Edge[];
}

export type AppTab = "projects" | "schema" | "graph";

export interface GraphFilters {
  label?: string;
  filePathPrefix?: string;
}
