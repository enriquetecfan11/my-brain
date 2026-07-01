import {
  getGraph,
  getProjects,
  getSchema,
  ProjectNotFoundError,
  type GetGraphOptions,
  type GraphResponse,
  type ProjectSummary,
  type SchemaResponse,
} from "./db.js";
import type { AppConfig } from "./config.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
}

export interface ChatConfig {
  ollamaUrl?: string;
  model?: string;
  maxToolIterations?: number;
}

export interface ChatRequest {
  projectName: string;
  messages: Array<{ role: string; content: string }>;
  config?: ChatConfig;
}

export interface ChatResponse {
  message: { role: "assistant"; content: string };
  toolCallsMade: number;
}

interface OllamaToolCall {
  type?: string;
  function: {
    name: string;
    arguments: Record<string, unknown> | string;
  };
}

interface OllamaChatResponse {
  message: ChatMessage;
  done: boolean;
  error?: string;
}

const GRAPH_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_graph_schema",
      description:
        "Get the schema of an indexed project: node labels, edge types, and counts. Call this first to understand what is in the graph.",
      parameters: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description:
              "Name of the indexed project. Omit to use the active project from the session.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_graph_slice",
      description:
        "Fetch a slice of the knowledge graph with optional filters. Returns nodes and edges between them.",
      parameters: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description:
              "Name of the indexed project. Omit to use the active project from the session.",
          },
          query: {
            type: "object",
            description: "Filters for the graph query",
            properties: {
              label: {
                type: "string",
                description: "Filter nodes by label (e.g. Function, Class, File)",
              },
              filePathPrefix: {
                type: "string",
                description: "Filter nodes whose file path starts with this prefix",
              },
              namePattern: {
                type: "string",
                description: "Substring to match against node names",
              },
              limit: {
                type: "number",
                description: "Max nodes to return (default 100, max 500)",
              },
            },
          },
        },
        required: [],
      },
    },
  },
] as const;

const SYSTEM_PROMPT_BASE = `You are a codebase architecture assistant. You help users understand indexed codebases by querying a knowledge graph stored locally.

The graph contains nodes (functions, classes, files, routes, etc.) and edges (CALLS, IMPORTS, HTTP_CALLS, DEFINES, etc.).

Use the provided tools to fetch additional graph slices when needed. Be concise and specific. Reference actual node names, file paths, and relationship types from tool results. If you lack data, say so and suggest which filter might help.`;

function findProjectMeta(
  projects: ProjectSummary[],
  projectName: string,
): ProjectSummary | undefined {
  return projects.find((p) => p.name === projectName);
}

function buildSystemPrompt(
  dashboardProjectName: string,
  schema: SchemaResponse,
  meta?: ProjectSummary,
): string {
  const toolProject = schema.project;
  const labels = schema.nodeLabels
    .slice(0, 25)
    .map((l) => `${l.label} (${l.count})`)
    .join(", ");
  const edges = schema.edgeTypes
    .slice(0, 25)
    .map((e) => `${e.type} (${e.count})`)
    .join(", ");

  const lines = [
    SYSTEM_PROMPT_BASE,
    "",
    "## Active project (session context)",
    `The user is exploring project "${toolProject}" (dashboard id: "${dashboardProjectName}").`,
    "Answer only about this project unless the user explicitly asks about another one.",
    `When calling tools, omit projectName to use "${toolProject}" automatically.`,
  ];

  if (meta?.path) {
    lines.push(`Repository root: ${meta.path}`);
  }
  if (meta?.indexedAt) {
    lines.push(`Last indexed: ${meta.indexedAt}`);
  }

  lines.push(
    "",
    "## Graph overview (pre-loaded — use tools for details)",
    `Nodes: ${schema.totalNodes.toLocaleString()} | Edges: ${schema.totalEdges.toLocaleString()}`,
    `Node labels: ${labels || "(none)"}`,
    `Edge types: ${edges || "(none)"}`,
  );

  return lines.join("\n");
}

function resolveOllamaUrl(appConfig: AppConfig, chatConfig?: ChatConfig): string {
  const raw = chatConfig?.ollamaUrl?.trim() || appConfig.ollamaUrl;
  return raw.replace(/\/$/, "");
}

export interface OllamaModelInfo {
  name: string;
  supportsTools: boolean;
}

export async function listOllamaModels(ollamaUrl: string): Promise<OllamaModelInfo[]> {
  const base = ollamaUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/api/tags`);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Ollama unreachable (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    models?: Array<{ name: string; capabilities?: string[] }>;
  };

  return (data.models ?? []).map((m) => ({
    name: m.name,
    supportsTools: m.capabilities?.includes("tools") ?? false,
  }));
}

async function resolveModel(
  appConfig: AppConfig,
  chatConfig: ChatConfig | undefined,
  ollamaUrl: string,
): Promise<string> {
  const explicit = chatConfig?.model?.trim() || appConfig.ollamaModel?.trim();
  if (explicit) return explicit;

  const models = await listOllamaModels(ollamaUrl);
  const withTools = models.filter((m) => m.supportsTools);
  const pick = withTools[0] ?? models[0];
  if (!pick) {
    throw new Error("No Ollama models found. Install one with: ollama pull <model>");
  }
  return pick.name;
}

function resolveMaxIterations(chatConfig?: ChatConfig): number {
  const n = chatConfig?.maxToolIterations ?? 8;
  return Math.min(Math.max(n, 1), 20);
}

function parseToolArguments(
  args: Record<string, unknown> | string,
): Record<string, unknown> {
  if (typeof args === "string") {
    try {
      const parsed: unknown = JSON.parse(args);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return args;
}

function executeGetGraphSchema(
  appConfig: AppConfig,
  projectName: string,
): SchemaResponse {
  return getSchema(appConfig, projectName);
}

function executeGetGraphSlice(
  appConfig: AppConfig,
  projectName: string,
  query: Record<string, unknown> = {},
): GraphResponse {
  const opts: GetGraphOptions = {};
  if (typeof query.label === "string" && query.label.trim()) {
    opts.label = query.label.trim();
  }
  if (typeof query.filePathPrefix === "string" && query.filePathPrefix.trim()) {
    opts.filePathPrefix = query.filePathPrefix.trim();
  }
  if (typeof query.namePattern === "string" && query.namePattern.trim()) {
    opts.namePattern = query.namePattern.trim();
  }
  if (typeof query.limit === "number" && Number.isFinite(query.limit)) {
    opts.limit = Math.min(Math.max(Math.floor(query.limit), 1), 500);
  } else {
    opts.limit = 100;
  }
  return getGraph(appConfig, projectName, opts);
}

function runTool(
  appConfig: AppConfig,
  defaultProject: string,
  resolvedProject: string,
  name: string,
  args: Record<string, unknown>,
): unknown {
  const projectName =
    typeof args.projectName === "string" && args.projectName.trim()
      ? args.projectName.trim()
      : resolvedProject || defaultProject;

  switch (name) {
    case "get_graph_schema":
      return executeGetGraphSchema(appConfig, projectName);
    case "get_graph_slice": {
      const query =
        typeof args.query === "object" && args.query !== null && !Array.isArray(args.query)
          ? (args.query as Record<string, unknown>)
          : {};
      return executeGetGraphSlice(appConfig, projectName, query);
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function callOllama(
  ollamaUrl: string,
  model: string,
  messages: ChatMessage[],
): Promise<OllamaChatResponse> {
  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      tools: GRAPH_TOOLS,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Ollama error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as OllamaChatResponse;
  if (data.error) {
    throw new Error(`Ollama error: ${data.error}`);
  }
  return data;
}

export async function handleChat(
  appConfig: AppConfig,
  req: ChatRequest,
): Promise<ChatResponse> {
  const { projectName, messages: userMessages, config: chatConfig } = req;

  if (!projectName?.trim()) {
    throw new Error("projectName is required");
  }
  if (!userMessages?.length) {
    throw new Error("messages must not be empty");
  }

  const ollamaUrl = resolveOllamaUrl(appConfig, chatConfig);
  const model = await resolveModel(appConfig, chatConfig, ollamaUrl);
  const maxIterations = resolveMaxIterations(chatConfig);

  const schema = getSchema(appConfig, projectName);
  const meta = findProjectMeta(getProjects(appConfig), projectName);
  const systemContent = buildSystemPrompt(projectName, schema, meta);

  const messages: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...userMessages.map((m) => ({
      role: m.role as ChatMessage["role"],
      content: m.content,
    })),
  ];

  let toolCallsMade = 0;

  for (let i = 0; i < maxIterations; i++) {
    const response = await callOllama(ollamaUrl, model, messages);
    const assistantMsg = response.message;

    const toolCalls = assistantMsg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        message: {
          role: "assistant",
          content: assistantMsg.content || "(No response)",
        },
        toolCallsMade,
      };
    }

    messages.push({
      role: "assistant",
      content: assistantMsg.content ?? "",
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const fnName = call.function.name;
      const fnArgs = parseToolArguments(call.function.arguments);
      let result: unknown;
      try {
        result = runTool(appConfig, projectName, schema.project, fnName, fnArgs);
      } catch (err) {
        if (err instanceof ProjectNotFoundError) {
          result = { error: err.message };
        } else {
          result = {
            error: err instanceof Error ? err.message : "tool execution failed",
          };
        }
      }

      toolCallsMade++;
      messages.push({
        role: "tool",
        tool_name: fnName,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    message: {
      role: "assistant",
      content:
        "I reached the maximum number of tool calls. Try a more specific question or increase maxToolIterations.",
    },
    toolCallsMade,
  };
}
