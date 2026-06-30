import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { projectDbPath, type AppConfig } from "./config.js";

export interface ProjectSummary {
  name: string;
  path: string;
  indexedAt: string | null;
  nodeCount: number;
  edgeCount: number;
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface EdgeTypeCount {
  type: string;
  count: number;
}

export interface SchemaResponse {
  project: string;
  totalNodes: number;
  totalEdges: number;
  nodeLabels: LabelCount[];
  edgeTypes: EdgeTypeCount[];
}

export interface GraphNode {
  id: number;
  label: string;
  name: string;
  qualifiedName: string;
  filePath: string;
  startLine: number;
  endLine: number;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: number;
  source: number;
  target: number;
  type: string;
  properties: Record<string, unknown>;
}

export interface GraphPagination {
  limit: number;
  offset: number;
  nodeCount: number;
  totalNodes: number;
  hasMore: boolean;
}

export interface GraphResponse {
  project: string;
  pagination: GraphPagination;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GetGraphOptions {
  limit?: number;
  offset?: number;
  label?: string;
  filePathPrefix?: string;
  namePattern?: string;
  edgeTypes?: string[];
  includeEdges?: boolean;
}

export interface ProjectDb {
  readonly projectName: string;
  readonly dbPath: string;
  readonly db: Database.Database;
  close(): void;
}

export class ProjectNotFoundError extends Error {
  constructor(public readonly projectName: string) {
    super(`Project not found: ${projectName}`);
    this.name = "ProjectNotFoundError";
  }
}

const DEFAULT_GRAPH_LIMIT = 500;
const MAX_GRAPH_LIMIT = 5000;

function parseProperties(raw: string | null | undefined): Record<string, unknown> {
  if (!raw || raw.trim() === "") return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isProjectDbFile(fileName: string): boolean {
  return (
    fileName.endsWith(".db") &&
    !fileName.endsWith("-wal") &&
    !fileName.endsWith("-shm")
  );
}

function hasGraphSchema(db: Database.Database): boolean {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM sqlite_master
       WHERE type = 'table' AND name IN ('nodes', 'edges')`,
    )
    .get() as { count: number };
  return row.count >= 2;
}

export function openProjectDb(config: AppConfig, projectName: string): ProjectDb {
  const dbPath = projectDbPath(config.cacheDir, projectName);
  if (!fs.existsSync(dbPath)) {
    throw new ProjectNotFoundError(projectName);
  }

  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  db.pragma("query_only = ON");

  return {
    projectName,
    dbPath,
    db,
    close() {
      db.close();
    },
  };
}

function resolveProjectName(handle: ProjectDb): string {
  const hasProjects = handle.db
    .prepare(
      `SELECT COUNT(*) AS count FROM sqlite_master
       WHERE type = 'table' AND name = 'projects'`,
    )
    .get() as { count: number };

  if (hasProjects.count === 0) {
    return handle.projectName;
  }

  const row = handle.db
    .prepare("SELECT name FROM projects LIMIT 1")
    .get() as { name?: string } | undefined;
  return row?.name ?? handle.projectName;
}

function countForProject(
  handle: ProjectDb,
  project: string,
  table: "nodes" | "edges",
): number {
  const row = handle.db
    .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE project = ?`)
    .get(project) as { count: number };
  return row.count;
}

export function getProjects(config: AppConfig): ProjectSummary[] {
  if (!fs.existsSync(config.cacheDir)) {
    return [];
  }

  const files = fs.readdirSync(config.cacheDir).filter(isProjectDbFile);
  const projects: ProjectSummary[] = [];

  for (const file of files) {
    const stem = path.basename(file, ".db");
    let handle: ProjectDb | null = null;
    try {
      handle = openProjectDb(config, stem);
      if (!hasGraphSchema(handle.db)) {
        continue;
      }

      const project = resolveProjectName(handle);
      let meta:
        | { name: string; root_path: string; indexed_at: string }
        | undefined;

      const hasProjects = handle.db
        .prepare(
          `SELECT COUNT(*) AS count FROM sqlite_master
           WHERE type = 'table' AND name = 'projects'`,
        )
        .get() as { count: number };

      if (hasProjects.count > 0) {
        meta = handle.db
          .prepare("SELECT name, root_path, indexed_at FROM projects WHERE name = ? LIMIT 1")
          .get(project) as
          | { name: string; root_path: string; indexed_at: string }
          | undefined;
      }

      projects.push({
        name: meta?.name ?? stem,
        path: meta?.root_path ?? "",
        indexedAt: meta?.indexed_at ?? null,
        nodeCount: countForProject(handle, project, "nodes"),
        edgeCount: countForProject(handle, project, "edges"),
      });
    } catch {
      // Skip unreadable or non-graph databases in the cache directory.
    } finally {
      handle?.close();
    }
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

export function getSchema(config: AppConfig, projectName: string): SchemaResponse {
  const handle = openProjectDb(config, projectName);
  try {
    const project = resolveProjectName(handle);

    const totalNodes = countForProject(handle, project, "nodes");
    const totalEdges = countForProject(handle, project, "edges");

    const nodeLabels = handle.db
      .prepare(
        `SELECT label, COUNT(*) AS count
         FROM nodes WHERE project = ?
         GROUP BY label ORDER BY count DESC`,
      )
      .all(project) as LabelCount[];

    const edgeTypes = handle.db
      .prepare(
        `SELECT type, COUNT(*) AS count
         FROM edges WHERE project = ?
         GROUP BY type ORDER BY count DESC`,
      )
      .all(project) as EdgeTypeCount[];

    return {
      project,
      totalNodes,
      totalEdges,
      nodeLabels,
      edgeTypes,
    };
  } finally {
    handle.close();
  }
}

export function getGraph(
  config: AppConfig,
  projectName: string,
  opts: GetGraphOptions = {},
): GraphResponse {
  const handle = openProjectDb(config, projectName);
  try {
    const project = resolveProjectName(handle);
    const limit = Math.min(
      Math.max(opts.limit ?? DEFAULT_GRAPH_LIMIT, 1),
      MAX_GRAPH_LIMIT,
    );
    const offset = Math.max(opts.offset ?? 0, 0);

    const where: string[] = ["project = ?"];
    const params: Array<string | number> = [project];

    if (opts.label) {
      where.push("label = ?");
      params.push(opts.label);
    }
    if (opts.filePathPrefix) {
      where.push("file_path LIKE ?");
      params.push(`${opts.filePathPrefix}%`);
    }
    if (opts.namePattern) {
      where.push("name LIKE ?");
      params.push(`%${opts.namePattern}%`);
    }

    const whereClause = where.join(" AND ");

    const totalRow = handle.db
      .prepare(`SELECT COUNT(*) AS count FROM nodes WHERE ${whereClause}`)
      .get(...params) as { count: number };
    const totalNodes = totalRow.count;

    const nodeRows = handle.db
      .prepare(
        `SELECT id, label, name, qualified_name, file_path, start_line, end_line, properties
         FROM nodes WHERE ${whereClause}
         ORDER BY id ASC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as Array<{
      id: number;
      label: string;
      name: string;
      qualified_name: string;
      file_path: string;
      start_line: number;
      end_line: number;
      properties: string;
    }>;

    const nodes: GraphNode[] = nodeRows.map((row) => ({
      id: row.id,
      label: row.label,
      name: row.name,
      qualifiedName: row.qualified_name,
      filePath: row.file_path,
      startLine: row.start_line,
      endLine: row.end_line,
      properties: parseProperties(row.properties),
    }));

    const nodeIds = nodes.map((n) => n.id);
    let edges: GraphEdge[] = [];

    if (opts.includeEdges !== false && nodeIds.length > 0) {
      const placeholders = nodeIds.map(() => "?").join(", ");
      const edgeParams: Array<string | number> = [project, ...nodeIds, ...nodeIds];
      let edgeSql = `
        SELECT id, source_id, target_id, type, properties
        FROM edges
        WHERE project = ?
          AND source_id IN (${placeholders})
          AND target_id IN (${placeholders})`;

      if (opts.edgeTypes && opts.edgeTypes.length > 0) {
        const typePlaceholders = opts.edgeTypes.map(() => "?").join(", ");
        edgeSql += ` AND type IN (${typePlaceholders})`;
        edgeParams.push(...opts.edgeTypes);
      }

      const edgeRows = handle.db.prepare(edgeSql).all(...edgeParams) as Array<{
        id: number;
        source_id: number;
        target_id: number;
        type: string;
        properties: string;
      }>;

      edges = edgeRows.map((row) => ({
        id: row.id,
        source: row.source_id,
        target: row.target_id,
        type: row.type,
        properties: parseProperties(row.properties),
      }));
    }

    const nodeCount = nodes.length;

    return {
      project,
      pagination: {
        limit,
        offset,
        nodeCount,
        totalNodes,
        hasMore: offset + nodeCount < totalNodes,
      },
      nodes,
      edges,
    };
  } finally {
    handle.close();
  }
}
