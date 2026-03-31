import type { MazeData, MazeWallDirection } from './mazeGenerator.shared'

type CellPosition = {
  x: number
  y: number
}

export type GraphTheoryNode = {
  cost: number
  id: number
  kind?: 'goal' | 'start'
  position: CellPosition
}

export type GraphTheoryEdge = {
  cost: number
  from: number
  to: number
}

export type GraphTheoryData = {
  edges: GraphTheoryEdge[]
  nodes: GraphTheoryNode[]
}

const DEFAULT_GRAPH_POSITIONS: CellPosition[] = [
  { x: 8, y: 8 },
  { x: 26, y: 22 },
  { x: 14, y: 38 },
  { x: 42, y: 12 },
  { x: 58, y: 28 },
  { x: 70, y: 10 },
  { x: 72, y: 42 },
]

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
  const safeNodeCount = Math.max(2, Math.min(nodeCount, DEFAULT_GRAPH_POSITIONS.length))
  const defaultNodeCosts = [6, 4, 3, 5, 2, 1, 7]
  const nodes: GraphTheoryNode[] = Array.from({ length: safeNodeCount }, (_, index) => ({
    cost: defaultNodeCosts[index] ?? 1,
    id: index,
    kind: index === 0 ? 'start' : index === safeNodeCount - 1 ? 'goal' : undefined,
    position: DEFAULT_GRAPH_POSITIONS[index],
  }))

  const edges: GraphTheoryEdge[] = [
    { cost: 2, from: 0, to: 1 },
    { cost: 4, from: 0, to: 2 },
    { cost: 3, from: 1, to: 2 },
    { cost: 1, from: 1, to: 3 },
    { cost: 5, from: 1, to: 4 },
    { cost: 2, from: 3, to: 5 },
    { cost: 4, from: 4, to: 5 },
    { cost: 3, from: 4, to: 6 },
  ].filter((edge) => edge.from < safeNodeCount && edge.to < safeNodeCount)

  return { edges, nodes }
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
        from,
        to,
      },
    ],
  }
}
