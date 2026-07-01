import Fastify from "fastify";
import { handleChat, listOllamaModels, type ChatRequest } from "./chat.js";
import { loadConfig } from "./config.js";
import {
  getGraph,
  getProjects,
  getSchema,
  ProjectNotFoundError,
  type GetGraphOptions,
} from "./db.js";
import { listIndexJobs, startIndex, type StartIndexRequest } from "./index.js";
import { getHomePath, listDirectory, pickFolder } from "./fs.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/api/chat/defaults", async () => ({
    ollamaUrl: config.ollamaUrl,
    model: config.ollamaModel,
    maxToolIterations: 8,
  }));

  app.get<{ Querystring: { ollamaUrl?: string } }>(
    "/api/chat/models",
    async (req, reply) => {
      try {
        const ollamaUrl =
          req.query.ollamaUrl?.trim() || config.ollamaUrl;
        const models = await listOllamaModels(ollamaUrl);
        return reply.send({ models });
      } catch (err) {
        app.log.error(err);
        const message = err instanceof Error ? err.message : "internal error";
        const status = message.startsWith("Ollama unreachable") ? 502 : 500;
        return reply.status(status).send({ error: message });
      }
    },
  );

  app.post<{ Body: ChatRequest }>("/api/chat", async (req, reply) => {
    try {
      const result = await handleChat(config, req.body);
      return reply.send(result);
    } catch (err) {
      if (err instanceof ProjectNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      app.log.error(err);
      const message = err instanceof Error ? err.message : "internal error";
      const status = message.startsWith("Ollama error") ? 502 : 400;
      return reply.status(status).send({ error: message });
    }
  });

  app.get("/api/projects", async (_req, reply) => {
    try {
      const projects = getProjects(config);
      return reply.send({ projects });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({
        error: err instanceof Error ? err.message : "internal error",
      });
    }
  });

  app.get("/api/index-status", async (_req, reply) => {
    return reply.send({ jobs: listIndexJobs() });
  });

  app.post<{ Body: StartIndexRequest }>("/api/index", async (req, reply) => {
    try {
      const result = startIndex(config, req.body);
      return reply.status(202).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "internal error";
      const status =
        message === "all index slots busy"
          ? 429
          : message === "directory not found" || message === "rootPath is required"
            ? 400
            : 500;
      return reply.status(status).send({ error: message });
    }
  });

  app.post("/api/pick-folder", async (_req, reply) => {
    try {
      const result = await pickFolder();
      return reply.send(result);
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({
        error: err instanceof Error ? err.message : "internal error",
      });
    }
  });

  app.get<{ Querystring: { path?: string } }>("/api/fs/list", async (req, reply) => {
    try {
      const listing = listDirectory(req.query.path);
      return reply.send(listing);
    } catch (err) {
      const message = err instanceof Error ? err.message : "internal error";
      const status = message.includes("not allowed") || message.includes("not found") ? 400 : 500;
      return reply.status(status).send({ error: message });
    }
  });

  app.get("/api/fs/home", async (_req, reply) => {
    return reply.send({ home: getHomePath() });
  });

  app.get<{ Params: { name: string } }>(
    "/api/projects/:name/schema",
    async (req, reply) => {
      try {
        const schema = getSchema(config, req.params.name);
        return reply.send(schema);
      } catch (err) {
        if (err instanceof ProjectNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        app.log.error(err);
        return reply.status(500).send({
          error: err instanceof Error ? err.message : "internal error",
        });
      }
    },
  );

  app.get<{
    Params: { name: string };
    Querystring: {
      limit?: string;
      offset?: string;
      label?: string;
      filePathPrefix?: string;
      namePattern?: string;
      edgeTypes?: string;
      includeEdges?: string;
    };
  }>("/api/projects/:name/graph", async (req, reply) => {
    try {
      const q = req.query;
      const opts: GetGraphOptions = {
        limit: q.limit !== undefined ? Number.parseInt(q.limit, 10) : undefined,
        offset: q.offset !== undefined ? Number.parseInt(q.offset, 10) : undefined,
        label: q.label,
        filePathPrefix: q.filePathPrefix,
        namePattern: q.namePattern,
        edgeTypes: q.edgeTypes
          ? q.edgeTypes.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        includeEdges: q.includeEdges !== "false",
      };

      const graph = getGraph(config, req.params.name, opts);
      return reply.send(graph);
    } catch (err) {
      if (err instanceof ProjectNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      app.log.error(err);
      return reply.status(500).send({
        error: err instanceof Error ? err.message : "internal error",
      });
    }
  });

  await app.listen({ host: config.host, port: config.port });
  app.log.info(
    { cacheDir: config.cacheDir, activeProject: config.activeProject },
    "Dashboard API listening",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
