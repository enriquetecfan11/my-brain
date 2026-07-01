import { useCallback, useEffect, useRef, useState } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type NodeObject,
  type LinkObject,
} from "react-force-graph-2d";
import { colorForLabel } from "../constants/colors";

// ── Exported types ──────────────────────────────────────────────────────────

/** API Node fields + degree counter + d3-force runtime positions */
export interface FGNode {
  id: number;
  label: string;
  name: string;
  qualifiedName: string;
  filePath: string;
  startLine: number;
  endLine: number;
  properties: Record<string, unknown>;
  __degree: number;
  // Injected by d3-force at runtime
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

/** API Edge fields. After simulation, source/target become FGNode objects. */
export interface FGLink {
  id: number;
  source: number | FGNode;
  target: number | FGNode;
  type: string;
  properties: Record<string, unknown>;
}

export interface FGGraphData {
  nodes: FGNode[];
  links: FGLink[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getLinkEndId(v: number | string | FGNode | NodeObject | undefined): number {
  if (v == null) return -1;
  if (typeof v === "object") return (v as FGNode).id;
  return Number(v);
}

function nodeRadius(node: FGNode, highlighted = false): number {
  const base = Math.max(3, Math.min(12, 3 + Math.sqrt(node.__degree)));
  return highlighted ? base + 2 : base;
}

/** Hex color with alpha byte appended */
function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

// ── Component ────────────────────────────────────────────────────────────────

interface GraphViewProps {
  graphData: FGGraphData;
  selectedNodeId: number | null;
  highlightNodeIds?: Set<number>;
  onNodeSelect: (node: FGNode | null) => void;
}

export function GraphView({
  graphData,
  selectedNodeId,
  highlightNodeIds,
  onNodeSelect,
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 560 });

  // react-force-graph ref — typed loosely because the generic is complex
  const fgRef = useRef<ForceGraphMethods<NodeObject, LinkObject> | undefined>(undefined);

  // Hover state stored in refs so canvas callbacks see current value without
  // triggering React re-renders on every mouse-move frame.
  const hoveredIdRef = useRef<number | null>(null);
  const neighborIdsRef = useRef<Set<number>>(new Set());
  const highlightIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    highlightIdsRef.current = highlightNodeIds ?? new Set();
  }, [highlightNodeIds]);

  // ── Container resize ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setDimensions({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Zoom to fit when graph data changes ──────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => fgRef.current?.zoomToFit(400, 48), 500);
    return () => clearTimeout(t);
  }, [graphData]);

  // ── Zoom to selected node ─────────────────────────────────────────────────
  useEffect(() => {
    if (selectedNodeId === null) return;
    const node = graphData.nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    const t = setTimeout(() => {
      if (node.x !== undefined && node.y !== undefined) {
        fgRef.current?.centerAt(node.x, node.y, 600);
        const cur = fgRef.current?.zoom() ?? 1;
        if (cur < 2.5) fgRef.current?.zoom(2.5, 600);
      }
    }, 100);
    return () => clearTimeout(t);
  }, [selectedNodeId, graphData.nodes]);

  // ── Rebuild neighbor set for hovered node ─────────────────────────────────
  const rebuildNeighbors = useCallback(
    (nodeId: number | null) => {
      if (nodeId === null) {
        neighborIdsRef.current = new Set();
        return;
      }
      const ids = new Set<number>();
      for (const link of graphData.links) {
        const src = getLinkEndId(link.source);
        const tgt = getLinkEndId(link.target);
        if (src === nodeId) ids.add(tgt);
        if (tgt === nodeId) ids.add(src);
      }
      neighborIdsRef.current = ids;
    },
    [graphData.links],
  );

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleNodeHover = useCallback(
    (node: NodeObject | null) => {
      hoveredIdRef.current = node ? (node as FGNode).id : null;
      rebuildNeighbors(hoveredIdRef.current);
    },
    [rebuildNeighbors],
  );

  const handleNodeClick = useCallback(
    (node: NodeObject) => {
      onNodeSelect(node as FGNode);
    },
    [onNodeSelect],
  );

  const handleBgClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  // ── Custom canvas renderers ────────────────────────────────────────────────
  const nodeCanvasObject = useCallback(
    (node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as FGNode;
      if (n.x === undefined || n.y === undefined) return;

      const isSelected = n.id === selectedNodeId;
      const isHovered = n.id === hoveredIdRef.current;
      const isNeighbor = neighborIdsRef.current.has(n.id);
      const isHighlighted = highlightIdsRef.current.has(n.id);
      const anyHovered = hoveredIdRef.current !== null;
      const anyHighlighted = highlightIdsRef.current.size > 0;

      const r = nodeRadius(n, isHighlighted);
      const color = colorForLabel(n.label);

      // Opacity: dim unrelated nodes when hovering or when search is active
      let opacity = 1;
      if (anyHovered) {
        opacity = isHovered || isNeighbor ? 1 : 0.15;
      } else if (anyHighlighted) {
        opacity = isHighlighted ? 1 : 0.2;
      }

      // Search highlight ring
      if (isHighlighted && !isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 4 / globalScale, 0, 2 * Math.PI);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // Glow for selected node
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 5 / globalScale, 0, 2 * Math.PI);
        ctx.fillStyle = withAlpha(color, 0.25);
        ctx.fill();
      }

      // Main circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? "#ffffff" : withAlpha(color, opacity);
      ctx.fill();

      // White ring for selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 2 / globalScale, 0, 2 * Math.PI);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      // Label: always show for selected/hovered/highlighted, otherwise above zoom 1.8
      if (isSelected || isHovered || isHighlighted || globalScale > 1.8) {
        const fontSize = Math.max(6, 11 / globalScale);
        ctx.font = `${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isSelected
          ? "#ffffff"
          : isHighlighted
            ? "#fbbf24"
            : `rgba(226,232,240,${opacity})`;
        const txt = n.name.length > 22 ? `${n.name.slice(0, 20)}…` : n.name;
        ctx.fillText(txt, n.x, n.y + r + 2 / globalScale);
      }
    },
    [selectedNodeId],
  );

  // Pointer area is slightly larger than the visible circle for easier click
  const nodePointerAreaPaint = useCallback(
    (node: NodeObject, color: string, ctx: CanvasRenderingContext2D) => {
      const n = node as FGNode;
      if (n.x === undefined || n.y === undefined) return;
      const highlighted = highlightIdsRef.current.has(n.id);
      ctx.beginPath();
      ctx.arc(n.x, n.y, nodeRadius(n, highlighted) + 6, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  const linkColor = useCallback((link: LinkObject): string => {
    const src = getLinkEndId(link.source);
    const tgt = getLinkEndId(link.target);
    const hov = hoveredIdRef.current;
    if (hov !== null) {
      return src === hov || tgt === hov ? "#60a5fa" : "#1e293b";
    }
    return "#334155";
  }, []);

  const linkWidth = useCallback((link: LinkObject): number => {
    const src = getLinkEndId(link.source);
    const tgt = getLinkEndId(link.target);
    const hov = hoveredIdRef.current;
    return hov !== null && (src === hov || tgt === hov) ? 2 : 0.5;
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="graph-canvas-wrapper">
      {graphData.nodes.length === 0 ? (
        <p className="status graph-empty-msg">No nodes — adjust filters.</p>
      ) : (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={
            graphData as {
              nodes: NodeObject[];
              links: LinkObject[];
            }
          }
          backgroundColor="#020617"
          nodeId="id"
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => "replace"}
          nodePointerAreaPaint={nodePointerAreaPaint}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBgClick}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0.08}
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
          cooldownTicks={120}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      )}
    </div>
  );
}
