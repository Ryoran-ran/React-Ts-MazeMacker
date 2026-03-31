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
  const positions = createDefaultGraphPositions(safeNodeCount)
  const nodes: GraphTheoryNode[] = Array.from({ length: safeNodeCount }, (_, index) => ({
    cost: (index % 9) + 1,
    id: index,
    kind: index === 0 ? 'start' : index === safeNodeCount - 1 ? 'goal' : undefined,
    label: String(index + 1),
    position: positions[index],
  }))

  const edges: GraphTheoryEdge[] = []

  for (let index = 0; index < safeNodeCount - 1; index += 1) {
    edges.push({
      cost: ((index + 1) % 5) + 1,
      direction: 'undirected',
      from: index,
      to: index + 1,
    })
  }

  for (let index = 0; index < safeNodeCount - 2; index += 2) {
    edges.push({
      cost: ((index + 3) % 5) + 1,
      direction: 'undirected',
      from: index,
      to: index + 2,
    })
  }

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
