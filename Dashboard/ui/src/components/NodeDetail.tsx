import { useMemo } from "react";
import { colorForLabel } from "../constants/colors";
import { getLinkEndId, type FGLink, type FGNode } from "./GraphView";

interface NodeDetailProps {
  node: FGNode;
  allLinks: FGLink[];
  onClose: () => void;
  onAskInChat?: (message: string) => void;
}

function buildNodeChatMessage(node: FGNode, inLinks: FGLink[], outLinks: FGLink[]): string {
  const neighbors = {
    incoming: inLinks.slice(0, 15).map((l) => {
      const src = typeof l.source === "object" ? (l.source as FGNode) : null;
      return {
        type: l.type,
        name: src?.name ?? `#${getLinkEndId(l.source)}`,
        filePath: src?.filePath,
      };
    }),
    outgoing: outLinks.slice(0, 15).map((l) => {
      const tgt = typeof l.target === "object" ? (l.target as FGNode) : null;
      return {
        type: l.type,
        name: tgt?.name ?? `#${getLinkEndId(l.target)}`,
        filePath: tgt?.filePath,
      };
    }),
  };

  const context = {
    label: node.label,
    name: node.name,
    qualifiedName: node.qualifiedName,
    filePath: node.filePath,
    startLine: node.startLine,
    degree: node.__degree,
    neighbors,
  };

  return (
    "Explícame este nodo y sus relaciones en la arquitectura.\n\n" +
    `Contexto del nodo:\n${JSON.stringify(context, null, 2)}`
  );
}

export function NodeDetail({ node, allLinks, onClose, onAskInChat }: NodeDetailProps) {
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
  const chatMessage = useMemo(
    () => buildNodeChatMessage(node, inLinks, outLinks),
    [node, inLinks, outLinks],
  );

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

      {onAskInChat && (
        <button
          type="button"
          className="node-detail__ask-chat"
          onClick={() => onAskInChat(chatMessage)}
        >
          Ask in Chat
        </button>
      )}

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
