import { useMemo } from "react";
import { colorForLabel } from "../constants/colors";
import { getLinkEndId, type FGLink, type FGNode } from "./GraphView";

interface NodeDetailProps {
  node: FGNode;
  allLinks: FGLink[];
  onClose: () => void;
}

export function NodeDetail({ node, allLinks, onClose }: NodeDetailProps) {
  const { inLinks, outLinks } = useMemo(() => {
    const inLinks: FGLink[] = [];
    const outLinks: FGLink[] = [];
    for (const link of allLinks) {
      const src = getLinkEndId(link.source);
      const tgt = getLinkEndId(link.target);
      if (tgt === node.id) inLinks.push(link);
      else if (src === node.id) outLinks.push(link);
    }
    return { inLinks, outLinks };
  }, [node.id, allLinks]);

  const labelColor = colorForLabel(node.label);

  return (
    <aside className="node-detail">
      <div className="node-detail__header">
        <div className="node-detail__title">
          <span
            className="node-detail__badge"
            style={{ borderColor: labelColor, color: labelColor }}
          >
            {node.label}
          </span>
          <h3 className="node-detail__name">{node.name}</h3>
        </div>
        <button type="button" className="node-detail__close" onClick={onClose} aria-label="Close detail">
          ✕
        </button>
      </div>

      <dl className="node-detail__meta">
        {node.filePath && (
          <>
            <dt>File</dt>
            <dd className="mono">
              {node.filePath}
              {node.startLine > 0 ? `:${node.startLine}` : ""}
            </dd>
          </>
        )}
        {node.qualifiedName && node.qualifiedName !== node.name && (
          <>
            <dt>Qualified</dt>
            <dd className="mono">{node.qualifiedName}</dd>
          </>
        )}
        <dt>Degree</dt>
        <dd>{node.__degree}</dd>
        <dt>Incoming</dt>
        <dd>{inLinks.length}</dd>
        <dt>Outgoing</dt>
        <dd>{outLinks.length}</dd>
      </dl>

      {inLinks.length > 0 && (
        <div className="node-detail__section">
          <h4>Incoming ({inLinks.length})</h4>
          <ul>
            {inLinks.slice(0, 25).map((l) => {
              const srcNode = typeof l.source === "object" ? (l.source as FGNode) : null;
              const srcName = srcNode?.name ?? `#${getLinkEndId(l.source)}`;
              return (
                <li key={l.id}>
                  <span className="edge-type">{l.type}</span>
                  {" ← "}
                  <span className="mono" title={srcNode?.qualifiedName}>{srcName}</span>
                </li>
              );
            })}
            {inLinks.length > 25 && (
              <li className="status">+{inLinks.length - 25} more</li>
            )}
          </ul>
        </div>
      )}

      {outLinks.length > 0 && (
        <div className="node-detail__section">
          <h4>Outgoing ({outLinks.length})</h4>
          <ul>
            {outLinks.slice(0, 25).map((l) => {
              const tgtNode = typeof l.target === "object" ? (l.target as FGNode) : null;
              const tgtName = tgtNode?.name ?? `#${getLinkEndId(l.target)}`;
              return (
                <li key={l.id}>
                  <span className="edge-type">{l.type}</span>
                  {" → "}
                  <span className="mono" title={tgtNode?.qualifiedName}>{tgtName}</span>
                </li>
              );
            })}
            {outLinks.length > 25 && (
              <li className="status">+{outLinks.length - 25} more</li>
            )}
          </ul>
        </div>
      )}
    </aside>
  );
}
