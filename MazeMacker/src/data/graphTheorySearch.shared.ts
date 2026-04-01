import type { GraphTheoryData } from './graphTheory'

export type GraphTheorySearchAlgorithm = 'astar' | 'dfs' | 'dijkstra'

export type GraphTheorySearchNode = {
  cost: number
  nodeId: number
  parent: number | null
}

export type GraphTheorySearchState = {
  algorithm: GraphTheorySearchAlgorithm
  costs: number[]
  currentNodeId: number | null
  frontier: GraphTheorySearchNode[]
  goalNodeId: number
  graph: GraphTheoryData
  isComplete: boolean
  isSolved: boolean
  openNodeIds: boolean[]
  parents: Array<number | null>
  pathEdgeIds: boolean[]
  pathNodeIds: boolean[]
  startNodeId: number
  stepCount: number
  visitedNodeIds: boolean[]
}

export const GRAPH_THEORY_SEARCH_ALGORITHM_OPTIONS: Array<{
  label: string
  value: GraphTheorySearchAlgorithm
}> = [
  { label: 'A*探索', value: 'astar' },
  { label: 'ダイクストラ法', value: 'dijkstra' },
  { label: '深さ優先探索', value: 'dfs' },
]

export function findGraphTheoryNodeByKind(
  graph: GraphTheoryData,
  kind: 'goal' | 'start',
) {
  return graph.nodes.find((node) => node.kind === kind)?.id ?? null
}

export function createNodeBooleanArray(graph: GraphTheoryData) {
  return graph.nodes.map(() => false)
}

export function createNodeCostArray(graph: GraphTheoryData) {
  return graph.nodes.map(() => Number.POSITIVE_INFINITY)
}

export function createNodeParentArray(graph: GraphTheoryData) {
  return graph.nodes.map(() => null as number | null)
}

export function createEdgeBooleanArray(graph: GraphTheoryData) {
  return graph.edges.map(() => false)
}

export function calculateGraphTheoryHeuristic(
  graph: GraphTheoryData,
  nodeId: number,
  goalNodeId: number,
) {
  const from = graph.nodes[nodeId]?.position
  const goal = graph.nodes[goalNodeId]?.position

  if (!from || !goal) {
    return 0
  }

  const directDistance = Math.hypot(goal.x - from.x, goal.y - from.y)
  let minimumCostPerDistance = Number.POSITIVE_INFINITY

  for (const edge of graph.edges) {
    const edgeFrom = graph.nodes[edge.from]?.position
    const edgeTo = graph.nodes[edge.to]?.position

    if (!edgeFrom || !edgeTo) {
      continue
    }

    const geometricDistance = Math.hypot(edgeTo.x - edgeFrom.x, edgeTo.y - edgeFrom.y)

    if (geometricDistance === 0) {
      continue
    }

    const forwardTraversalCost = getGraphTheoryTraversalCost(graph, edge.from, edge.to, edge.cost)
    const backwardTraversalCost = getGraphTheoryTraversalCost(graph, edge.to, edge.from, edge.cost)

    if (edge.direction !== 'backward') {
      minimumCostPerDistance = Math.min(
        minimumCostPerDistance,
        forwardTraversalCost / geometricDistance,
      )
    }

    if (edge.direction !== 'forward') {
      minimumCostPerDistance = Math.min(
        minimumCostPerDistance,
        backwardTraversalCost / geometricDistance,
      )
    }
  }

  if (!Number.isFinite(minimumCostPerDistance)) {
    return 0
  }

  return directDistance * minimumCostPerDistance
}

export function getGraphTheoryNeighbors(graph: GraphTheoryData, nodeId: number) {
  return graph.edges.flatMap((edge, edgeIndex) => {
    if (edge.direction === 'undirected') {
      if (edge.from === nodeId) {
        return [
          {
            edgeCost: edge.cost,
            edgeIndex,
            nodeCost: graph.nodes[edge.to].cost,
            nodeId: edge.to,
          },
        ]
      }

      if (edge.to === nodeId) {
        return [
          {
            edgeCost: edge.cost,
            edgeIndex,
            nodeCost: graph.nodes[edge.from].cost,
            nodeId: edge.from,
          },
        ]
      }

      return []
    }

    if (edge.direction === 'forward' && edge.from === nodeId) {
      return [
        {
          edgeCost: edge.cost,
          edgeIndex,
          nodeCost: graph.nodes[edge.to].cost,
          nodeId: edge.to,
        },
      ]
    }

    if (edge.direction === 'backward' && edge.to === nodeId) {
      return [
        {
          edgeCost: edge.cost,
          edgeIndex,
          nodeCost: graph.nodes[edge.from].cost,
          nodeId: edge.from,
        },
      ]
    }

    return []
  })
}

export function getGraphTheoryTraversalCost(
  graph: GraphTheoryData,
  _fromNodeId: number,
  toNodeId: number,
  edgeCost: number,
) {
  const toNodeCost = graph.nodes[toNodeId]?.cost ?? 0

  return edgeCost + toNodeCost
}

export function buildGraphTheoryPathState(
  graph: GraphTheoryData,
  parents: Array<number | null>,
  startNodeId: number,
  goalNodeId: number,
) {
  const pathNodeIds = createNodeBooleanArray(graph)
  const pathEdgeIds = createEdgeBooleanArray(graph)
  let currentNodeId: number | null = goalNodeId

  while (currentNodeId !== null) {
    pathNodeIds[currentNodeId] = true

    if (currentNodeId === startNodeId) {
      break
    }

    const parentNodeId: number | null = parents[currentNodeId]

    if (parentNodeId === null) {
      break
    }

    const edgeIndex = graph.edges.findIndex((edge) => {
      return (
        (edge.from === parentNodeId && edge.to === currentNodeId) ||
        (edge.from === currentNodeId && edge.to === parentNodeId)
      )
    })

    if (edgeIndex >= 0) {
      pathEdgeIds[edgeIndex] = true
    }

    currentNodeId = parentNodeId
  }

  return { pathEdgeIds, pathNodeIds }
}

export function createGraphTheorySearchState(
  graph: GraphTheoryData,
  algorithm: GraphTheorySearchAlgorithm = 'astar',
): GraphTheorySearchState {
  const startNodeId = findGraphTheoryNodeByKind(graph, 'start') ?? 0
  const goalNodeId = findGraphTheoryNodeByKind(graph, 'goal') ?? Math.max(0, graph.nodes.length - 1)
  const openNodeIds = createNodeBooleanArray(graph)
  const visitedNodeIds = createNodeBooleanArray(graph)
  const parents = createNodeParentArray(graph)
  const costs = createNodeCostArray(graph)
  const startCost = graph.nodes[startNodeId]?.cost ?? 0
  const frontier = [{ cost: startCost, nodeId: startNodeId, parent: null }]

  openNodeIds[startNodeId] = algorithm === 'dfs'
  costs[startNodeId] = startCost

  return {
    algorithm,
    costs,
    currentNodeId: null,
    frontier,
    goalNodeId,
    graph,
    isComplete: false,
    isSolved: false,
    openNodeIds,
    parents,
    pathEdgeIds: createEdgeBooleanArray(graph),
    pathNodeIds: createNodeBooleanArray(graph),
    startNodeId,
    stepCount: 0,
    visitedNodeIds,
  }
}

export function completeGraphTheorySearch(
  initialState: GraphTheorySearchState,
  stepGraphTheorySearch: (state: GraphTheorySearchState) => GraphTheorySearchState,
) {
  let currentState = initialState

  while (!currentState.isComplete) {
    currentState = stepGraphTheorySearch(currentState)
  }

  return currentState
}
