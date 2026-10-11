import type { MazeData, MazeWallDirection } from './mazeGenerator.shared'

type CellPosition = {
  x: number
  y: number
}

export type GraphTheoryNode = {
  cost: number
  id: number
  kind?: 'goal' | 'start'
  label: string
  position: CellPosition
}

export type GraphTheoryEdge = {
  cost: number
  direction: 'backward' | 'forward' | 'undirected'
  from: number
  to: number
}

export type GraphTheoryData = {
  edges: GraphTheoryEdge[]
  nodes: GraphTheoryNode[]
}

export const GRAPH_THEORY_WORLD_WIDTH = 80
export const GRAPH_THEORY_WORLD_HEIGHT = 50

const DIRECTION_OFFSETS: Record<MazeWallDirection, { dx: number; dy: number }> = {
  top: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  bottom: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
}

const OPPOSITE_DIRECTION: Record<MazeWallDirection, MazeWallDirection> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
}

function createDefaultGraphPositions(nodeCount: number) {
  const centerX = 40
  const centerY = 25
  const radiusX = 31
  const radiusY = 18

  return Array.from({ length: nodeCount }, (_, index) => {
    const ratio = index / nodeCount
    const angle = -Math.PI / 2 + ratio * Math.PI * 2
    const wobble = index % 2 === 0 ? 1 : 0.82

    return {
      x: centerX + Math.cos(angle) * radiusX * wobble,
      y: centerY + Math.sin(angle) * radiusY * wobble,
    }
  })
}

function createDefaultGraphEdges(nodeCount: number): GraphTheoryEdge[] {
  const edges: GraphTheoryEdge[] = []

  for (let index = 0; index < nodeCount - 1; index += 1) {
    edges.push({
      cost: ((index + 1) % 5) + 1,
      direction: 'undirected',
      from: index,
      to: index + 1,
    })
  }

  for (let index = 0; index < nodeCount - 2; index += 2) {
    edges.push({
      cost: ((index + 3) % 5) + 1,
      direction: 'undirected',
      from: index,
      to: index + 2,
    })
  }

  return edges
}

function createLaidOutDefaultGraphPositions(nodeCount: number, edges: GraphTheoryEdge[]) {
  const positions = createDefaultGraphPositions(nodeCount).map((position) => ({ ...position }))
  const centerX = GRAPH_THEORY_WORLD_WIDTH / 2
  const centerY = GRAPH_THEORY_WORLD_HEIGHT / 2
  const margin = 6
  const repulsionStrength = 180
  const springStrength = 0.018
  const preferredEdgeLength = Math.min(24, 12 + nodeCount * 1.35)

  for (let iteration = 0; iteration < 140; iteration += 1) {
    const forces = positions.map(() => ({ x: 0, y: 0 }))

    for (let fromIndex = 0; fromIndex < positions.length; fromIndex += 1) {
      for (let toIndex = fromIndex + 1; toIndex < positions.length; toIndex += 1) {
        const dx = positions[toIndex].x - positions[fromIndex].x
        const dy = positions[toIndex].y - positions[fromIndex].y
        const distanceSquared = Math.max(1, dx * dx + dy * dy)
        const distance = Math.sqrt(distanceSquared)
        const magnitude = repulsionStrength / distanceSquared
        const ux = dx / distance
        const uy = dy / distance

        forces[fromIndex].x -= ux * magnitude
        forces[fromIndex].y -= uy * magnitude
        forces[toIndex].x += ux * magnitude
        forces[toIndex].y += uy * magnitude
      }
    }

    for (const edge of edges) {
      const from = positions[edge.from]
      const to = positions[edge.to]
      const dx = to.x - from.x
      const dy = to.y - from.y
      const distance = Math.max(1, Math.hypot(dx, dy))
      const magnitude = (distance - preferredEdgeLength) * springStrength
      const ux = dx / distance
      const uy = dy / distance

      forces[edge.from].x += ux * magnitude
      forces[edge.from].y += uy * magnitude
      forces[edge.to].x -= ux * magnitude
      forces[edge.to].y -= uy * magnitude
    }

    for (let index = 0; index < positions.length; index += 1) {
      const centerDx = centerX - positions[index].x
      const centerDy = centerY - positions[index].y
      forces[index].x += centerDx * 0.0025
      forces[index].y += centerDy * 0.0025

      positions[index].x = Math.max(
        margin,
        Math.min(GRAPH_THEORY_WORLD_WIDTH - margin, positions[index].x + forces[index].x),
      )
      positions[index].y = Math.max(
        margin,
        Math.min(GRAPH_THEORY_WORLD_HEIGHT - margin, positions[index].y + forces[index].y),
      )
    }
  }

  return positions
}

function findAvailableGraphNodePosition(
  occupiedPositions: CellPosition[],
  preferredPosition: CellPosition,
  minDistance = 9,
) {
  const margin = 6
  const candidates: CellPosition[] = [{ ...preferredPosition }]

  for (let radius = 4; radius <= 28; radius += 4) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
      candidates.push({
        x: preferredPosition.x + Math.cos(angle) * radius,
        y: preferredPosition.y + Math.sin(angle) * radius,
      })
    }
  }

  let bestCandidate = {
    x: Math.max(margin, Math.min(GRAPH_THEORY_WORLD_WIDTH - margin, preferredPosition.x)),
    y: Math.max(margin, Math.min(GRAPH_THEORY_WORLD_HEIGHT - margin, preferredPosition.y)),
  }
  let bestNearestDistance = -1

  for (const candidate of candidates) {
    const clamped = {
      x: Math.max(margin, Math.min(GRAPH_THEORY_WORLD_WIDTH - margin, candidate.x)),
      y: Math.max(margin, Math.min(GRAPH_THEORY_WORLD_HEIGHT - margin, candidate.y)),
    }
    const nearestDistance = occupiedPositions.reduce((nearest, occupied) => {
      const distance = Math.hypot(clamped.x - occupied.x, clamped.y - occupied.y)
      return Math.min(nearest, distance)
    }, Number.POSITIVE_INFINITY)

    if (nearestDistance >= minDistance) {
      return clamped
    }

    if (nearestDistance > bestNearestDistance) {
      bestNearestDistance = nearestDistance
      bestCandidate = clamped
    }
  }

  return bestCandidate
}

function getOpenDirections(maze: MazeData, position: CellPosition) {
  const cell = maze[position.y][position.x]

  return (['top', 'right', 'bottom', 'left'] as MazeWallDirection[]).filter(
    (direction) => !cell.walls[direction],
  )
}

function isTurn(directions: MazeWallDirection[]) {
  if (directions.length !== 2) {
    return false
  }

  const [first, second] = directions

  return OPPOSITE_DIRECTION[first] !== second
}

function isGraphNode(maze: MazeData, position: CellPosition) {
  const cell = maze[position.y][position.x]
  const directions = getOpenDirections(maze, position)

  return Boolean(cell.kind) || directions.length !== 2 || isTurn(directions)
}

export function buildGraphTheoryData(maze: MazeData): GraphTheoryData {
  const nodes: GraphTheoryNode[] = []
  const nodeIdByKey = new Map<string, number>()

  for (let y = 0; y < maze.length; y += 1) {
    for (let x = 0; x < maze[y].length; x += 1) {
      const position = { x, y }

      if (!isGraphNode(maze, position)) {
        continue
      }

      const id = nodes.length
      nodes.push({
        cost: 1,
        id,
        kind: maze[y][x].kind,
        label: String(id + 1),
        position,
      })
      nodeIdByKey.set(`${x}:${y}`, id)
    }
  }

  const edges: GraphTheoryEdge[] = []

  for (const node of nodes) {
    const directions = getOpenDirections(maze, node.position)

    for (const direction of directions) {
      const offset = DIRECTION_OFFSETS[direction]
      let cursor = {
        x: node.position.x + offset.dx,
        y: node.position.y + offset.dy,
      }
      let travelDirection = direction
      let cost = maze[node.position.y][node.position.x].costs[direction]

      while (
        cursor.y >= 0 &&
        cursor.y < maze.length &&
        cursor.x >= 0 &&
        cursor.x < maze[0].length
      ) {
        const targetNodeId = nodeIdByKey.get(`${cursor.x}:${cursor.y}`)

        if (targetNodeId !== undefined) {
          if (node.id < targetNodeId) {
            edges.push({
              cost,
              direction: 'undirected',
              from: node.id,
              to: targetNodeId,
            })
          }
          break
        }

        const directionsAtCursor = getOpenDirections(maze, cursor)
        const nextDirection = directionsAtCursor.find(
          (candidate) => candidate !== OPPOSITE_DIRECTION[travelDirection],
        )

        if (!nextDirection) {
          break
        }

        cost += maze[cursor.y][cursor.x].costs[nextDirection]
        const nextOffset = DIRECTION_OFFSETS[nextDirection]
        cursor = {
          x: cursor.x + nextOffset.dx,
          y: cursor.y + nextOffset.dy,
        }
        travelDirection = nextDirection
      }
    }
  }

  return { edges, nodes }
}

export function createDefaultGraphTheoryData(nodeCount = 7): GraphTheoryData {
  const safeNodeCount = Math.max(2, Math.min(nodeCount, 24))
  const edges = createDefaultGraphEdges(safeNodeCount)
  const positions = createLaidOutDefaultGraphPositions(safeNodeCount, edges)
  const nodes: GraphTheoryNode[] = Array.from({ length: safeNodeCount }, (_, index) => ({
    cost: (index % 9) + 1,
    id: index,
    kind: index === 0 ? 'start' : index === safeNodeCount - 1 ? 'goal' : undefined,
    label: String(index + 1),
    position: positions[index],
  }))

  return { edges, nodes }
}

export function resizeGraphTheoryData(
  graph: GraphTheoryData,
  nodeCount: number,
): GraphTheoryData {
  const safeNodeCount = Math.max(2, Math.min(nodeCount, 24))

  if (safeNodeCount === graph.nodes.length) {
    return graph
  }

  const defaultGraph = createDefaultGraphTheoryData(safeNodeCount)

  if (safeNodeCount < graph.nodes.length) {
    const keptNodes = graph.nodes.slice(0, safeNodeCount).map((node, index) => ({
      ...node,
      id: index,
    }))
    const keptNodeIds = new Set(keptNodes.map((node) => node.id))
    let nodes = keptNodes

    if (!nodes.some((node) => node.kind === 'start')) {
      nodes = nodes.map((node, index) => ({
        ...node,
        kind: index === 0 ? 'start' : node.kind,
      }))
    }

    if (!nodes.some((node) => node.kind === 'goal')) {
      nodes = nodes.map((node, index) => ({
        ...node,
        kind: index === nodes.length - 1 ? 'goal' : node.kind,
      }))
    }

    const edges = graph.edges.filter(
      (edge) => keptNodeIds.has(edge.from) && keptNodeIds.has(edge.to),
    )

    return {
      edges,
      nodes,
    }
  }

  const existingNodes = graph.nodes.map((node, index) => ({
    ...node,
    id: index,
  }))
  const occupiedPositions = existingNodes.map((node) => node.position)
  const appendedNodes = defaultGraph.nodes.slice(graph.nodes.length).map((node, offset) => {
    const position = findAvailableGraphNodePosition(occupiedPositions, node.position)
    occupiedPositions.push(position)

    return {
      ...node,
      id: graph.nodes.length + offset,
      kind: undefined,
      position,
    }
  })

  return {
    edges: graph.edges,
    nodes: [...existingNodes, ...appendedNodes],
  }
}

export function setGraphTheoryEdgeCost(
  graph: GraphTheoryData,
  edgeIndex: number,
  cost: number,
): GraphTheoryData {
  return {
    ...graph,
    edges: graph.edges.map((edge, index) =>
      index === edgeIndex
        ? { ...edge, cost: Math.max(0, Math.trunc(cost)) }
        : edge,
    ),
  }
}

export function cycleGraphTheoryEdgeDirection(
  graph: GraphTheoryData,
  edgeIndex: number,
): GraphTheoryData {
  return {
    ...graph,
    edges: graph.edges.map((edge, index) => {
      if (index !== edgeIndex) {
        return edge
      }

      const nextDirection =
        edge.direction === 'undirected'
          ? 'forward'
          : edge.direction === 'forward'
            ? 'backward'
            : 'undirected'

      return {
        ...edge,
        direction: nextDirection,
      }
    }),
  }
}

export function setGraphTheoryNodeCost(
  graph: GraphTheoryData,
  nodeIndex: number,
  cost: number,
): GraphTheoryData {
  return {
    ...graph,
    nodes: graph.nodes.map((node, index) =>
      index === nodeIndex
        ? { ...node, cost: Math.max(0, Math.trunc(cost)) }
        : node,
    ),
  }
}

export function setGraphTheoryNodeLabel(
  graph: GraphTheoryData,
  nodeIndex: number,
  label: string,
): GraphTheoryData {
  return {
    ...graph,
    nodes: graph.nodes.map((node, index) =>
      index === nodeIndex
        ? { ...node, label: label.trim() || String(node.id + 1) }
        : node,
    ),
  }
}

export function setGraphTheoryNodeKind(
  graph: GraphTheoryData,
  nodeIndex: number,
  kind: 'goal' | 'start',
): GraphTheoryData {
  return {
    ...graph,
    nodes: graph.nodes.map((node, index) => ({
      ...node,
      kind: index === nodeIndex ? kind : node.kind === kind ? undefined : node.kind,
    })),
  }
}

export function setAllGraphTheoryEdgeCosts(
  graph: GraphTheoryData,
  cost: number,
): GraphTheoryData {
  const normalizedCost = Math.max(0, Math.trunc(cost))

  return {
    ...graph,
    edges: graph.edges.map((edge) => ({
      ...edge,
      cost: normalizedCost,
    })),
  }
}

export function setAllGraphTheoryNodeCosts(
  graph: GraphTheoryData,
  cost: number,
): GraphTheoryData {
  const normalizedCost = Math.max(0, Math.trunc(cost))

  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      cost: normalizedCost,
    })),
  }
}

export function setGraphTheoryNodePosition(
  graph: GraphTheoryData,
  nodeIndex: number,
  position: CellPosition,
): GraphTheoryData {
  return {
    ...graph,
    nodes: graph.nodes.map((node, index) =>
      index === nodeIndex
        ? {
            ...node,
            position: {
              x: Math.max(0, Math.min(GRAPH_THEORY_WORLD_WIDTH, position.x)),
              y: Math.max(0, Math.min(GRAPH_THEORY_WORLD_HEIGHT, position.y)),
            },
          }
        : node,
    ),
  }
}

export function addGraphTheoryEdge(
  graph: GraphTheoryData,
  fromNodeIndex: number,
  toNodeIndex: number,
  cost: number,
): GraphTheoryData {
  if (
    fromNodeIndex === toNodeIndex ||
    fromNodeIndex < 0 ||
    toNodeIndex < 0 ||
    fromNodeIndex >= graph.nodes.length ||
    toNodeIndex >= graph.nodes.length
  ) {
    return graph
  }

  const from = Math.min(fromNodeIndex, toNodeIndex)
  const to = Math.max(fromNodeIndex, toNodeIndex)
  const hasSameEdge = graph.edges.some((edge) => edge.from === from && edge.to === to)

  if (hasSameEdge) {
    return {
      ...graph,
      edges: graph.edges.filter((edge) => !(edge.from === from && edge.to === to)),
    }
  }

  return {
    ...graph,
    edges: [
      ...graph.edges,
      {
        cost: Math.max(0, Math.trunc(cost)),
        direction: 'undirected',
        from,
        to,
      },
    ],
  }
}
