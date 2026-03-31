import { useEffect, useRef, useState } from 'react'
import {
  GRAPH_THEORY_WORLD_HEIGHT,
  GRAPH_THEORY_WORLD_WIDTH,
  type GraphTheoryData,
} from '../data/graphTheory'

type CellPosition = {
  x: number
  y: number
}

type GraphTheoryCanvasProps = {
  currentNodeId?: number | null
  graph: GraphTheoryData
  editable?: boolean
  editEdgeCostValue?: number
  isNodeLabelVisible?: boolean
  nodeTextOrder?: 'costFirst' | 'labelFirst'
  editNodeLabelValue?: string
  editNodeCostValue?: number
  editMode?: 'cost' | 'direction' | 'goal' | 'move' | 'name' | 'start' | 'wall'
  onEdgeAdd?: (fromNodeIndex: number, toNodeIndex: number, cost: number) => void
  onEdgeCostSet?: (edgeIndex: number, cost: number) => void
  onEdgeDirectionCycle?: (edgeIndex: number) => void
  onNodeKindSet?: (nodeIndex: number, kind: 'goal' | 'start') => void
  onNodeCostSet?: (nodeIndex: number, cost: number) => void
  onNodeLabelSet?: (nodeIndex: number, label: string) => void
  onNodePositionSet?: (nodeIndex: number, position: CellPosition) => void
  openNodeIds?: boolean[]
  pathEdgeIds?: boolean[]
  pathNodeIds?: boolean[]
  showEdgeCosts?: boolean
  visitedNodeIds?: boolean[]
}

function GraphTheoryCanvas({
  currentNodeId = null,
  graph,
  editable = false,
  editEdgeCostValue = 1,
  isNodeLabelVisible = true,
  nodeTextOrder = 'labelFirst',
  editNodeLabelValue = '',
  editNodeCostValue = 1,
  editMode = 'wall',
  onEdgeAdd,
  onEdgeCostSet,
  onEdgeDirectionCycle,
  onNodeKindSet,
  onNodeCostSet,
  onNodeLabelSet,
  onNodePositionSet,
  openNodeIds,
  pathEdgeIds,
  pathNodeIds,
  showEdgeCosts = true,
  visitedNodeIds,
}: GraphTheoryCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ height: 0, width: 0 })
  const [hoverEdgeIndex, setHoverEdgeIndex] = useState<number | null>(null)
  const [hoverNodeIndex, setHoverNodeIndex] = useState<number | null>(null)
  const [pendingEdgeStartNodeIndex, setPendingEdgeStartNodeIndex] = useState<number | null>(null)
  const [draggingNodeIndex, setDraggingNodeIndex] = useState<number | null>(null)

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

  useEffect(() => {
    setPendingEdgeStartNodeIndex(null)
  }, [editMode, graph])

  const width = Math.max(containerSize.width, 320)
  const height = Math.max(containerSize.height, 320)
  const padding = 56
  const nodeRadius = Math.max(18, Math.min(44, 220 / Math.sqrt(graph.nodes.length || 1)))
  const edgeStroke = Math.max(2, nodeRadius * 0.16)

  function project(position: CellPosition) {
    const usableWidth = Math.max(1, width - padding * 2)
    const usableHeight = Math.max(1, height - padding * 2)

    return {
      x: padding + (position.x / GRAPH_THEORY_WORLD_WIDTH) * usableWidth,
      y: padding + (position.y / GRAPH_THEORY_WORLD_HEIGHT) * usableHeight,
    }
  }

  function unproject(pointerX: number, pointerY: number) {
    const usableWidth = Math.max(1, width - padding * 2)
    const usableHeight = Math.max(1, height - padding * 2)

    return {
      x: Math.max(
        0,
        Math.min(
          GRAPH_THEORY_WORLD_WIDTH,
          ((pointerX - padding) / usableWidth) * GRAPH_THEORY_WORLD_WIDTH,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          GRAPH_THEORY_WORLD_HEIGHT,
          ((pointerY - padding) / usableHeight) * GRAPH_THEORY_WORLD_HEIGHT,
        ),
      ),
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

  function getNearestNodeIndex(pointerX: number, pointerY: number) {
    let nearestIndex: number | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const [index, node] of graph.nodes.entries()) {
      const projected = project(node.position)
      const distance = Math.hypot(pointerX - projected.x, pointerY - projected.y)

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    }

    return nearestDistance <= nodeRadius ? nearestIndex : null
  }

  function getArrowPoints(
    from: CellPosition,
    to: CellPosition,
    reverseDirection = false,
  ) {
    const start = reverseDirection ? to : from
    const end = reverseDirection ? from : to
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy)

    if (length === 0) {
      return null
    }

    const ux = dx / length
    const uy = dy / length
    const centerRatio = 0.58
    const tipX = start.x + dx * centerRatio
    const tipY = start.y + dy * centerRatio
    const baseX = tipX - ux * 12
    const baseY = tipY - uy * 12
    const perpX = -uy
    const perpY = ux

    return {
      tipX,
      tipY,
      leftX: baseX + perpX * 5,
      leftY: baseY + perpY * 5,
      rightX: baseX - perpX * 5,
      rightY: baseY - perpY * 5,
    }
  }

  return (
    <div
      ref={containerRef}
      className={`graph-theory-canvas ${editable ? 'graph-theory-canvas--editable' : ''}`}
      onClick={(event) => {
        if (
          !editable ||
          !containerRef.current ||
          (editMode === 'cost' && !onEdgeCostSet && !onNodeCostSet) ||
          (editMode === 'direction' && !onEdgeDirectionCycle) ||
          ((editMode === 'start' || editMode === 'goal') && !onNodeKindSet) ||
          (editMode === 'name' && !onNodeLabelSet)
        ) {
          return
        }

        const rect = containerRef.current.getBoundingClientRect()
        const scaleX = width / rect.width
        const scaleY = height / rect.height
        const pointerX = (event.clientX - rect.left) * scaleX
        const pointerY = (event.clientY - rect.top) * scaleY
        const edgeIndex = getNearestEdgeIndex(pointerX, pointerY)
        const nodeIndex = getNearestNodeIndex(pointerX, pointerY)

        if (editMode === 'direction') {
          if (edgeIndex !== null) {
            onEdgeDirectionCycle?.(edgeIndex)
          }
          return
        }

        if (nodeIndex !== null && (editMode === 'start' || editMode === 'goal')) {
          onNodeKindSet?.(nodeIndex, editMode)
          return
        }

        if (nodeIndex !== null && editMode === 'name') {
          onNodeLabelSet?.(nodeIndex, editNodeLabelValue)
          return
        }

        if (editMode === 'move') {
          return
        }

        if (nodeIndex !== null && editMode === 'wall') {
          if (pendingEdgeStartNodeIndex === null) {
            setPendingEdgeStartNodeIndex(nodeIndex)
            return
          }

          if (pendingEdgeStartNodeIndex !== nodeIndex) {
            onEdgeAdd?.(pendingEdgeStartNodeIndex, nodeIndex, editEdgeCostValue)
          }

          setPendingEdgeStartNodeIndex(null)
          return
        }

        if (nodeIndex !== null && editMode === 'cost') {
          onNodeCostSet?.(nodeIndex, editNodeCostValue)
          return
        }

        if (editMode !== 'cost') {
          return
        }

        if (edgeIndex === null) {
          return
        }

        onEdgeCostSet?.(edgeIndex, editEdgeCostValue)
      }}
      onMouseLeave={() => {
        setHoverEdgeIndex(null)
        setHoverNodeIndex(null)
        setDraggingNodeIndex(null)
      }}
      onMouseDown={(event) => {
        if (!editable || editMode !== 'move' || !containerRef.current) {
          return
        }

        const rect = containerRef.current.getBoundingClientRect()
        const scaleX = width / rect.width
        const scaleY = height / rect.height
        const pointerX = (event.clientX - rect.left) * scaleX
        const pointerY = (event.clientY - rect.top) * scaleY
        const nodeIndex = getNearestNodeIndex(pointerX, pointerY)

        if (nodeIndex === null) {
          return
        }

        setDraggingNodeIndex(nodeIndex)
        setHoverNodeIndex(nodeIndex)
      }}
      onMouseUp={() => {
        setDraggingNodeIndex(null)
      }}
      onMouseMove={(event) => {
        if (
          !editable ||
          (editMode !== 'cost' &&
            editMode !== 'direction' &&
            editMode !== 'start' &&
            editMode !== 'goal' &&
            editMode !== 'name' &&
            editMode !== 'move' &&
            editMode !== 'wall') ||
          !containerRef.current
        ) {
          setHoverEdgeIndex(null)
          setHoverNodeIndex(null)
          return
        }

        const rect = containerRef.current.getBoundingClientRect()
        const scaleX = width / rect.width
        const scaleY = height / rect.height
        const pointerX = (event.clientX - rect.left) * scaleX
        const pointerY = (event.clientY - rect.top) * scaleY

        if (editMode === 'move' && draggingNodeIndex !== null) {
          onNodePositionSet?.(draggingNodeIndex, unproject(pointerX, pointerY))
          setHoverNodeIndex(draggingNodeIndex)
          setHoverEdgeIndex(null)
          return
        }

        const nextNodeIndex = getNearestNodeIndex(pointerX, pointerY)
        const nextEdgeIndex = getNearestEdgeIndex(pointerX, pointerY)

        if (editMode === 'direction') {
          setHoverNodeIndex(null)
          setHoverEdgeIndex(nextEdgeIndex)
          return
        }

        setHoverNodeIndex(nextNodeIndex)
        setHoverEdgeIndex(
          editMode === 'cost' && nextNodeIndex === null
            ? nextEdgeIndex
            : null,
        )
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
          const isPath = pathEdgeIds?.[edgeIndex]
          const stroke =
            isPath
              ? '#4ade80'
              : isHovered
                ? 'rgba(37, 99, 235, 0.22)'
                : '#94a3b8'
          const strokeWidth = isPath
            ? edgeStroke * 1.7
            : isHovered
              ? edgeStroke * 1.2
              : edgeStroke

          return (
            <g key={`${edge.from}-${edge.to}-${edgeIndex}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={stroke}
                strokeWidth={strokeWidth}
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
          const isHovered = hoverNodeIndex === node.id
          const isPendingEdgeStart = pendingEdgeStartNodeIndex === node.id
          const isCurrent = currentNodeId === node.id
          const isPath = Boolean(pathNodeIds?.[node.id])
          const isOpen = Boolean(openNodeIds?.[node.id])
          const isVisited = Boolean(visitedNodeIds?.[node.id])
          const hoverFill =
            editMode === 'start'
              ? 'rgba(37, 99, 235, 0.16)'
              : editMode === 'goal'
                ? 'rgba(220, 38, 38, 0.16)'
              : editMode === 'move'
                  ? 'rgba(37, 99, 235, 0.16)'
                : editMode === 'name'
                  ? 'rgba(37, 99, 235, 0.16)'
                : editMode === 'wall'
                  ? 'rgba(37, 99, 235, 0.16)'
                  : 'rgba(37, 99, 235, 0.10)'
          const fill =
            isCurrent
              ? '#f59e0b'
              : isPath
                ? '#86efac'
                : isOpen
                  ? '#fde68a'
                  : isVisited
                    ? '#dbeafe'
                    : node.kind === 'start'
                      ? '#dbeafe'
                    : node.kind === 'goal'
                        ? '#fee2e2'
                        : '#ffffff'
          const primaryText = nodeTextOrder === 'costFirst' ? String(node.cost) : node.label
          const secondaryText = nodeTextOrder === 'costFirst' ? node.label : String(node.cost)

          return (
            <g key={node.id}>
              {isHovered ? (
                <circle
                  cx={projected.x}
                  cy={projected.y}
                  r={nodeRadius * 1.18}
                  fill={hoverFill}
                />
              ) : null}
              {isPendingEdgeStart ? (
                <circle
                  cx={projected.x}
                  cy={projected.y}
                  r={nodeRadius * 1.34}
                  fill="rgba(37, 99, 235, 0.18)"
                />
              ) : null}
              <circle
                cx={projected.x}
                cy={projected.y}
                r={nodeRadius}
                fill={fill}
                stroke={
                  isCurrent
                    ? '#d97706'
                    : isHovered || isPendingEdgeStart
                      ? '#2563eb'
                      : '#e5e7eb'
                }
                strokeWidth={isCurrent || isHovered || isPendingEdgeStart ? 4 : 2}
              />
              {isNodeLabelVisible ? (
                <>
                  <text
                    x={projected.x}
                    y={projected.y + nodeRadius * 0.1}
                    fill="#020617"
                    fontSize={Math.max(12, nodeRadius * 0.62)}
                    fontWeight="500"
                    textAnchor="middle"
                  >
                    {primaryText}
                  </text>
                  <text
                    x={projected.x}
                    y={projected.y + nodeRadius * 0.58}
                    fill="#475569"
                    fontSize={Math.max(9, nodeRadius * 0.28)}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {secondaryText}
                  </text>
                </>
              ) : (
                <text
                  x={projected.x}
                  y={projected.y + nodeRadius * 0.28}
                  fill="#020617"
                  fontSize={Math.max(14, nodeRadius * 1.05)}
                  fontWeight="500"
                  textAnchor="middle"
                >
                  {node.cost}
                </text>
              )}
              {node.kind ? (
                <g>
                  <circle
                    cx={projected.x - nodeRadius * 0.56}
                    cy={projected.y - nodeRadius * 0.56}
                    r={Math.max(9, nodeRadius * 0.28)}
                    fill={node.kind === 'start' ? '#2563eb' : '#dc2626'}
                  />
                  <text
                    x={projected.x - nodeRadius * 0.56}
                    y={projected.y - nodeRadius * 0.56 + 4}
                    fill="#ffffff"
                    fontSize={Math.max(10, nodeRadius * 0.3)}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {node.kind === 'start' ? 'S' : 'G'}
                  </text>
                </g>
              ) : null}
            </g>
          )
        })}
        {graph.edges.map((edge, edgeIndex) => {
          if (edge.direction === 'undirected') {
            return null
          }

          const from = project(graph.nodes[edge.from].position)
          const to = project(graph.nodes[edge.to].position)
          const isHovered = hoverEdgeIndex === edgeIndex
          const arrow = getArrowPoints(from, to, edge.direction === 'backward')
          const isPath = Boolean(pathEdgeIds?.[edgeIndex])

          if (!arrow) {
            return null
          }

          return (
            <polygon
              key={`arrow-${edge.from}-${edge.to}-${edgeIndex}`}
              points={`${arrow.tipX},${arrow.tipY} ${arrow.leftX},${arrow.leftY} ${arrow.rightX},${arrow.rightY}`}
              fill={isPath ? '#16a34a' : isHovered ? '#0f172a' : '#475569'}
              stroke="#ffffff"
              strokeWidth={3}
              strokeLinejoin="round"
            />
          )
        })}
      </svg>
    </div>
  )
}

export default GraphTheoryCanvas
