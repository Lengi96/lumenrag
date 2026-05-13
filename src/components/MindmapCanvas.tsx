"use client";

import type { MindmapGraph, MindmapNode } from "@/lib/types";

type Props = {
  graph: MindmapGraph;
  selectedNodeId?: string;
  onSelectNode: (node: MindmapNode) => void;
};

export function MindmapCanvas({ graph, selectedNodeId, onSelectNode }: Props) {
  return (
    <svg viewBox="0 0 1000 620" className="h-full min-h-[420px] w-full rounded-lg bg-[#071014]">
      <defs>
        <radialGradient id="gridGlow" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#0f2f36" />
          <stop offset="60%" stopColor="#071014" />
          <stop offset="100%" stopColor="#050809" />
        </radialGradient>
      </defs>
      <rect width="1000" height="620" fill="url(#gridGlow)" />
      <g opacity="0.16">
        {Array.from({ length: 16 }).map((_, index) => (
          <line key={`v-${index}`} x1={index * 70} x2={index * 70} y1="0" y2="620" stroke="#8bd7e8" />
        ))}
        {Array.from({ length: 10 }).map((_, index) => (
          <line key={`h-${index}`} x1="0" x2="1000" y1={index * 70} y2={index * 70} stroke="#8bd7e8" />
        ))}
      </g>
      <g>
        {graph.edges.map((edge) => {
          const source = graph.nodes.find((node) => node.id === edge.source);
          const target = graph.nodes.find((node) => node.id === edge.target);
          if (!source || !target) return null;
          return (
            <line
              key={edge.id}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="#7dd3fc"
              strokeOpacity={0.2 + edge.strength * 0.35}
              strokeWidth={1 + edge.strength * 2}
            />
          );
        })}
      </g>
      <g>
        {graph.nodes.map((node) => {
          const selected = selectedNodeId === node.id;
          return (
            <g key={node.id} role="button" tabIndex={0} onClick={() => onSelectNode(node)} className="cursor-pointer">
              <circle
                cx={node.x}
                cy={node.y}
                r={node.size + (selected ? 7 : 0)}
                fill={node.color}
                fillOpacity={node.kind === "document" ? 0.12 : 0.92}
                stroke={selected ? "#ffffff" : node.color}
                strokeWidth={selected ? 3 : 1.5}
              />
              <text
                x={node.x}
                y={node.y + node.size + 18}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize={node.kind === "workspace" ? 18 : 12}
                fontWeight={node.kind === "workspace" || node.kind === "document" ? 700 : 500}
              >
                {node.label.length > 28 ? `${node.label.slice(0, 25)}...` : node.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
