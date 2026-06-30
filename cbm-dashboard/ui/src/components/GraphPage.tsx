import { useCallback, useMemo, useState } from "react";
import { useGraph } from "../hooks/useGraph";
import { useSchema } from "../hooks/useSchema";
import type { Edge, Node } from "../types";
import { getLinkEndId, GraphView, type FGGraphData, type FGLink, type FGNode } from "./GraphView";
import { NodeDetail } from "./NodeDetail";

// ── Constants ────────────────────────────────────────────────────────────────

const GLOBAL_LIMIT = 2000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeDegrees(nodes: Node[], edges: Edge[]): Map<number, number> {
  const deg = new Map<number, number>(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
    deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
  }
  return deg;
}

function buildHighlightIds(nodes: FGNode[], query: string): Set<number> {
  const q = query.trim().toLowerCase();
  if (!q) return new Set();
  const ids = new Set<number>();
  for (const node of nodes) {
    if (
      node.name.toLowerCase().includes(q) ||
      node.qualifiedName.toLowerCase().includes(q)
    ) {
      ids.add(node.id);
    }
  }
  return ids;
}

/**
 * Build a local subgraph centred on `centerId` up to `depth` hops away.
 * Works correctly whether link.source/target are still raw number ids
 * (before simulation) or already mutated to FGNode objects (after simulation).
 */
function buildLocalSubgraph(
  allNodes: FGNode[],
  allLinks: FGLink[],
  centerId: number,
  depth: 1 | 2,
): FGGraphData {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  const included = new Set<number>([centerId]);

  const expand = (seeds: Set<number>) => {
    for (const link of allLinks) {
      const src = getLinkEndId(link.source);
      const tgt = getLinkEndId(link.target);
      if (seeds.has(src)) included.add(tgt);
      if (seeds.has(tgt)) included.add(src);
    }
  };

  expand(new Set([centerId]));
  if (depth === 2) {
    const d1 = new Set([...included].filter((id) => id !== centerId));
    expand(d1);
  }

  const nodes = [...included]
    .map((id) => nodeMap.get(id))
    .filter((n): n is FGNode => n !== undefined);

  const links = allLinks.filter((link) => {
    const src = getLinkEndId(link.source);
    const tgt = getLinkEndId(link.target);
    return included.has(src) && included.has(tgt);
  });

  return { nodes, links };
}

// ── Component ────────────────────────────────────────────────────────────────

interface GraphPageProps {
  projectName: string | null;
  onAskInChat?: (message: string) => void;
}

export function GraphPage({ projectName, onAskInChat }: GraphPageProps) {
  // Filter inputs (uncommitted — apply on button click or Enter)
  const [labelInput, setLabelInput] = useState("");
  const [pathInput, setPathInput] = useState("");

  // Applied filters (what the hook actually uses)
  const [appliedLabel, setAppliedLabel] = useState<string | undefined>();
  const [appliedPath, setAppliedPath] = useState<string | undefined>();

  // Visual-only search (no extra HTTP request)
  const [searchQuery, setSearchQuery] = useState("");

  // Edge type filter — empty array means show all types
  const [edgeTypeFilter, setEdgeTypeFilter] = useState<string[]>([]);

  // Graph interaction state
  const [selectedNode, setSelectedNode] = useState<FGNode | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const [localDepth, setLocalDepth] = useState<1 | 2>(1);

  // Schema for label dropdown and edge types
  const { schema } = useSchema(projectName);
  const availableLabels = useMemo(
    () => schema?.nodeLabels.map((l) => l.label).sort() ?? [],
    [schema],
  );

  // Data
  const { graph, isLoading, error, refresh } = useGraph({
    projectName,
    limit: GLOBAL_LIMIT,
    offset: 0,
    label: appliedLabel,
    filePathPrefix: appliedPath,
  });

  // Edge types: prefer schema, fallback to types present in the current page
  const availableEdgeTypes = useMemo(() => {
    if (schema?.edgeTypes.length) {
      return schema.edgeTypes.map((t) => t.type).sort();
    }
    if (!graph) return [] as string[];
    return [...new Set(graph.edges.map((e) => e.type))].sort();
  }, [schema, graph]);

  // Build ForceGraph data (with degree) — memoised so the reference is stable
  // between re-renders and doesn't reset the d3 simulation unnecessarily.
  const { fgNodes, fgLinks } = useMemo<{
    fgNodes: FGNode[];
    fgLinks: FGLink[];
  }>(() => {
    if (!graph) return { fgNodes: [], fgLinks: [] };

    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    let validEdges = graph.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
    );

    if (edgeTypeFilter.length > 0) {
      const allowed = new Set(edgeTypeFilter);
      validEdges = validEdges.filter((e) => allowed.has(e.type));
    }

    const degrees = computeDegrees(graph.nodes, validEdges);

    const fgNodes: FGNode[] = graph.nodes.map((n) => ({
      ...n,
      __degree: degrees.get(n.id) ?? 0,
    }));

    const fgLinks: FGLink[] = validEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      properties: e.properties,
    }));

    return { fgNodes, fgLinks };
  }, [graph, edgeTypeFilter]);

  // Visible subgraph: full or local around selected node
  const visibleData = useMemo<FGGraphData>(() => {
    if (localMode && selectedNode) {
      return buildLocalSubgraph(fgNodes, fgLinks, selectedNode.id, localDepth);
    }
    return { nodes: fgNodes, links: fgLinks };
  }, [localMode, selectedNode, fgNodes, fgLinks, localDepth]);

  // Search highlights — visual only, over loaded nodes
  const highlightNodeIds = useMemo(
    () => buildHighlightIds(fgNodes, searchQuery),
    [fgNodes, searchQuery],
  );

  const visibleHighlightCount = useMemo(() => {
    if (highlightNodeIds.size === 0) return 0;
    const visibleIds = new Set(visibleData.nodes.map((n) => n.id));
    let count = 0;
    for (const id of highlightNodeIds) {
      if (visibleIds.has(id)) count++;
    }
    return count;
  }, [highlightNodeIds, visibleData.nodes]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const applyFilters = useCallback(() => {
    setAppliedLabel(labelInput.trim() || undefined);
    setAppliedPath(pathInput.trim() || undefined);
    setSelectedNode(null);
    setLocalMode(false);
  }, [labelInput, pathInput]);

  const clearFilters = useCallback(() => {
    setLabelInput("");
    setPathInput("");
    setAppliedLabel(undefined);
    setAppliedPath(undefined);
    setSearchQuery("");
    setEdgeTypeFilter([]);
    setSelectedNode(null);
    setLocalMode(false);
  }, []);

  const handleNodeSelect = useCallback((node: FGNode | null) => {
    setSelectedNode(node);
    if (!node) setLocalMode(false);
  }, []);

  const handleLabelSelect = (label: string) => {
    setLabelInput(label);
  };

  const toggleEdgeType = (type: string) => {
    setEdgeTypeFilter((prev) => {
      const all = availableEdgeTypes;
      if (prev.length === 1 && prev[0] === "__none__") {
        return [type];
      }

      const current = prev.length === 0 ? all : prev;

      let next: string[];
      if (current.includes(type)) {
        next = current.filter((t) => t !== type);
      } else {
        next = [...current, type];
      }

      // All types selected again → reset to empty (= show all)
      if (next.length === all.length) return [];
      return next;
    });
  };

  const selectAllEdgeTypes = () => setEdgeTypeFilter([]);
  const clearEdgeTypes = () => setEdgeTypeFilter(["__none__"]);

  // ── Guard ────────────────────────────────────────────────────────────────

  if (!projectName) {
    return <p className="status">Select a project on the Projects tab first.</p>;
  }

  const tooLarge = graph?.pagination.hasMore ?? false;
  const totalNodes = graph?.pagination.totalNodes ?? 0;
  const edgeFilterActive = edgeTypeFilter.length > 0;
  const noneSelected = edgeTypeFilter.length === 1 && edgeTypeFilter[0] === "__none__";

  return (
    <div className="graph-page">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="graph-toolbar">
        <div className="graph-toolbar__filters">
          {availableLabels.length > 0 && (
            <label>
              Label
              <select
                value={labelInput}
                onChange={(e) => handleLabelSelect(e.target.value)}
              >
                <option value="">All</option>
                {availableLabels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            File path prefix
            <input
              type="text"
              value={pathInput}
              placeholder="e.g. src/api/"
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </label>

          <label>
            Search node
            <input
              type="search"
              value={searchQuery}
              placeholder="name or qualifiedName"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>

          <button type="button" onClick={applyFilters}>
            Apply
          </button>
          <button type="button" onClick={clearFilters}>
            Clear
          </button>
          <button type="button" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>

        {/* Local / Global toggle — visible only when a node is selected */}
        {selectedNode && (
          <div className="graph-toolbar__mode">
            <button
              type="button"
              className={!localMode ? "btn--active" : ""}
              onClick={() => setLocalMode(false)}
            >
              Global
            </button>
            <button
              type="button"
              className={localMode ? "btn--active" : ""}
              onClick={() => setLocalMode(true)}
            >
              Local
            </button>
            {localMode && (
              <label className="depth-label">
                Depth
                <select
                  value={localDepth}
                  onChange={(e) => setLocalDepth(Number(e.target.value) as 1 | 2)}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </label>
            )}
          </div>
        )}
      </div>

      {/* ── Edge type filter ─────────────────────────────────────── */}
      {availableEdgeTypes.length > 0 && (
        <div className="graph-edge-filters">
          <span className="graph-edge-filters__label">Edge types</span>
          <div className="graph-edge-filters__actions">
            <button type="button" onClick={selectAllEdgeTypes} disabled={!edgeFilterActive}>
              All
            </button>
            <button
              type="button"
              onClick={clearEdgeTypes}
              disabled={noneSelected}
            >
              None
            </button>
          </div>
          <div className="graph-edge-filters__types">
            {availableEdgeTypes.map((type) => (
              <label key={type} className="edge-type-chip">
                <input
                  type="checkbox"
                  checked={!noneSelected && (!edgeFilterActive || edgeTypeFilter.includes(type))}
                  onChange={() => toggleEdgeType(type)}
                />
                <span>{type}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Notices ─────────────────────────────────────────────── */}
      {tooLarge && (
        <p className="graph-notice">
          Showing first {GLOBAL_LIMIT.toLocaleString()} of{" "}
          {totalNodes.toLocaleString()} nodes — use filters to narrow down.
        </p>
      )}
      {searchQuery.trim() && (
        <p className="graph-notice graph-notice--search">
          {highlightNodeIds.size === 0
            ? `No matches for "${searchQuery.trim()}" in loaded nodes.`
            : `${highlightNodeIds.size} match${highlightNodeIds.size === 1 ? "" : "es"} in loaded data` +
              (visibleHighlightCount < highlightNodeIds.size
                ? ` (${visibleHighlightCount} visible in current view)`
                : "") +
              "."}
        </p>
      )}
      {isLoading && <p className="status">Loading graph…</p>}
      {error && <p className="status status--error">{error}</p>}

      {/* ── Workspace ───────────────────────────────────────────── */}
      <div className="graph-workspace">
        <GraphView
          graphData={visibleData}
          selectedNodeId={selectedNode?.id ?? null}
          highlightNodeIds={highlightNodeIds}
          onNodeSelect={handleNodeSelect}
        />

        {selectedNode && (
          <NodeDetail
            node={selectedNode}
            allLinks={fgLinks}
            onClose={() => handleNodeSelect(null)}
            onAskInChat={onAskInChat}
          />
        )}
      </div>
    </div>
  );
}
