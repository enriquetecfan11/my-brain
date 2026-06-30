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

export type AppTab = "projects" | "schema" | "graph" | "chat";

export interface GraphFilters {
  label?: string;
  filePathPrefix?: string;
}

/** POST /api/chat */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatConfig {
  ollamaUrl: string;
  model: string;
  maxToolIterations: number;
}

export interface ChatRequest {
  projectName: string;
  messages: ChatMessage[];
  config?: ChatConfig;
}

export interface ChatResponse {
  message: { role: "assistant"; content: string };
  toolCallsMade: number;
}

export interface ChatDefaults {
  ollamaUrl: string;
  model: string;
  maxToolIterations: number;
}

export interface OllamaModelInfo {
  name: string;
  supportsTools: boolean;
}

export interface ChatModelsResponse {
  models: OllamaModelInfo[];
}

/** POST /api/index */
export type IndexMode = "full" | "fast" | "moderate";

export interface StartIndexRequest {
  rootPath: string;
  projectName?: string;
  mode?: IndexMode;
}

export interface StartIndexResponse {
  status: "indexing";
  slot: number;
  path: string;
}

export interface IndexJob {
  slot: number;
  status: "idle" | "running" | "done" | "error";
  rootPath: string;
  projectName: string;
  mode: string;
  error: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface IndexStatusResponse {
  jobs: IndexJob[];
}

export interface FsEntry {
  name: string;
  path: string;
}

export interface FsListResponse {
  path: string;
  parent: string | null;
  entries: FsEntry[];
}

export interface PickFolderResponse {
  path: string | null;
  cancelled: boolean;
  native: boolean;
}
