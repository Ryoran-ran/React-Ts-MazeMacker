import { useEffect, useRef, useState } from 'react'
import type { GraphTheoryData } from '../data/graphTheory'

type CellPosition = {
  x: number
  y: number
}

type GraphTheoryCanvasProps = {
  graph: GraphTheoryData
  showEdgeCosts?: boolean
}

function GraphTheoryCanvas({
  graph,
  showEdgeCosts = true,
}: GraphTheoryCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ height: 0, width: 0 })

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerSize({ width, height })
    })

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [])

  const width = Math.max(containerSize.width, 320)
  const height = Math.max(containerSize.height, 320)
  const maxX = Math.max(...graph.nodes.map((node) => node.position.x), 1)
  const maxY = Math.max(...graph.nodes.map((node) => node.position.y), 1)
  const padding = 56
  const nodeRadius = Math.max(18, Math.min(44, 220 / Math.sqrt(graph.nodes.length || 1)))
  const edgeStroke = Math.max(2, nodeRadius * 0.16)

  function project(position: CellPosition) {
    const usableWidth = Math.max(1, width - padding * 2)
    const usableHeight = Math.max(1, height - padding * 2)

    return {
      x: padding + (position.x / maxX) * usableWidth,
      y: padding + (position.y / maxY) * usableHeight,
    }
  }

  return (
    <div ref={containerRef} className="graph-theory-canvas">
      <svg
        className="graph-theory-canvas__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Graph theory view"
      >
        <rect width={width} height={height} fill="#ffffff" rx="20" ry="20" />
        {graph.edges.map((edge) => {
          const from = project(graph.nodes[edge.from].position)
          const to = project(graph.nodes[edge.to].position)
          const labelX = (from.x + to.x) / 2
          const labelY = (from.y + to.y) / 2

          return (
            <g key={`${edge.from}-${edge.to}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#94a3b8"
                strokeWidth={edgeStroke}
                strokeLinecap="round"
              />
              {showEdgeCosts ? (
                <g>
                  <rect
                    x={labelX - 14}
                    y={labelY - 10}
                    width={28}
                    height={20}
                    rx={10}
                    fill="#111827"
                  />
                  <text
                    x={labelX}
                    y={labelY + 4}
                    fill="#e2e8f0"
                    fontSize={Math.max(10, nodeRadius * 0.42)}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {edge.cost}
                  </text>
                </g>
              ) : null}
            </g>
          )
        })}
        {graph.nodes.map((node) => {
          const projected = project(node.position)
          const fill =
            node.kind === 'start'
              ? '#dbeafe'
              : node.kind === 'goal'
                ? '#fee2e2'
                : '#ffffff'

          return (
            <g key={node.id}>
              <circle
                cx={projected.x}
                cy={projected.y}
                r={nodeRadius}
                fill={fill}
                stroke="#e5e7eb"
                strokeWidth={2}
              />
              <text
                x={projected.x}
                y={projected.y + nodeRadius * 0.28}
                fill="#020617"
                fontSize={Math.max(14, nodeRadius * 1.05)}
                fontWeight="500"
                textAnchor="middle"
              >
                {node.id + 1}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default GraphTheoryCanvas
