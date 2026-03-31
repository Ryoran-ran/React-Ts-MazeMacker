import { useEffect, useRef, useState } from 'react'
import type { GraphTheoryData } from '../data/graphTheory'

type CellPosition = {
  x: number
  y: number
}

type GraphTheoryCanvasProps = {
  graph: GraphTheoryData
  editable?: boolean
  editCostValue?: number
  editMode?: 'cost' | 'goal' | 'start' | 'wall'
  onEdgeCostSet?: (edgeIndex: number, cost: number) => void
  showEdgeCosts?: boolean
}

function GraphTheoryCanvas({
  graph,
  editable = false,
  editCostValue = 1,
  editMode = 'wall',
  onEdgeCostSet,
  showEdgeCosts = true,
}: GraphTheoryCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ height: 0, width: 0 })
  const [hoverEdgeIndex, setHoverEdgeIndex] = useState<number | null>(null)

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

  function getNearestEdgeIndex(pointerX: number, pointerY: number) {
    let nearestIndex: number | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const [index, edge] of graph.edges.entries()) {
      const from = project(graph.nodes[edge.from].position)
      const to = project(graph.nodes[edge.to].position)
      const dx = to.x - from.x
      const dy = to.y - from.y
      const lengthSquared = dx * dx + dy * dy

      if (lengthSquared === 0) {
        continue
      }

      const t = Math.max(
        0,
        Math.min(1, ((pointerX - from.x) * dx + (pointerY - from.y) * dy) / lengthSquared),
      )
      const projectedX = from.x + dx * t
      const projectedY = from.y + dy * t
      const distance = Math.hypot(pointerX - projectedX, pointerY - projectedY)

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    }

    return nearestDistance <= Math.max(18, nodeRadius * 0.6) ? nearestIndex : null
  }

  return (
    <div
      ref={containerRef}
      className={`graph-theory-canvas ${editable ? 'graph-theory-canvas--editable' : ''}`}
      onClick={(event) => {
        if (!editable || editMode !== 'cost' || !onEdgeCostSet || !containerRef.current) {
          return
        }

        const rect = containerRef.current.getBoundingClientRect()
        const scaleX = width / rect.width
        const scaleY = height / rect.height
        const edgeIndex = getNearestEdgeIndex(
          (event.clientX - rect.left) * scaleX,
          (event.clientY - rect.top) * scaleY,
        )

        if (edgeIndex === null) {
          return
        }

        onEdgeCostSet(edgeIndex, editCostValue)
      }}
      onMouseLeave={() => {
        setHoverEdgeIndex(null)
      }}
      onMouseMove={(event) => {
        if (!editable || editMode !== 'cost' || !containerRef.current) {
          setHoverEdgeIndex(null)
          return
        }

        const rect = containerRef.current.getBoundingClientRect()
        const scaleX = width / rect.width
        const scaleY = height / rect.height
        setHoverEdgeIndex(getNearestEdgeIndex(
          (event.clientX - rect.left) * scaleX,
          (event.clientY - rect.top) * scaleY,
        ))
      }}
    >
      <svg
        className="graph-theory-canvas__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Graph theory view"
      >
        <rect width={width} height={height} fill="#ffffff" rx="20" ry="20" />
        {graph.edges.map((edge, edgeIndex) => {
          const from = project(graph.nodes[edge.from].position)
          const to = project(graph.nodes[edge.to].position)
          const labelX = (from.x + to.x) / 2
          const labelY = (from.y + to.y) / 2
          const isHovered = hoverEdgeIndex === edgeIndex

          return (
            <g key={`${edge.from}-${edge.to}-${edgeIndex}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isHovered ? '#2563eb' : '#94a3b8'}
                strokeWidth={isHovered ? edgeStroke * 1.8 : edgeStroke}
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
