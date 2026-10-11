import {
  buildGraphTheoryPathState,
  calculateGraphTheoryHeuristic,
  getGraphTheoryNeighbors,
  getGraphTheoryTraversalCost,
  type GraphTheorySearchNode,
  type GraphTheorySearchState,
} from './graphTheorySearch.shared'

function takeNextNode(state: GraphTheorySearchState, frontier: GraphTheorySearchNode[]) {
  while (frontier.length > 0) {
    let bestIndex = 0
    let bestHeuristic = calculateGraphTheoryHeuristic(
      state.graph,
      frontier[0].nodeId,
      state.goalNodeId,
    )
    let bestScore = frontier[0].cost + bestHeuristic

    for (let index = 1; index < frontier.length; index += 1) {
      const heuristic = calculateGraphTheoryHeuristic(
        state.graph,
        frontier[index].nodeId,
        state.goalNodeId,
      )
      const score = frontier[index].cost + heuristic

      if (score < bestScore || (score === bestScore && heuristic < bestHeuristic)) {
        bestIndex = index
        bestHeuristic = heuristic
        bestScore = score
      }
    }

    const [candidate] = frontier.splice(bestIndex, 1)

    if (candidate.cost <= state.costs[candidate.nodeId]) {
      return candidate
    }
  }

  return undefined
}

export function stepGraphTheoryAStarSearch(state: GraphTheorySearchState): GraphTheorySearchState {
  const frontier = [...state.frontier]
  const openNodeIds = [...state.openNodeIds]
  const visitedNodeIds = [...state.visitedNodeIds]
  const parents = [...state.parents]
  const costs = [...state.costs]
  const currentNode = takeNextNode(state, frontier)

  if (!currentNode) {
    return {
      ...state,
      costs,
      currentNodeId: null,
      frontier: [],
      isComplete: true,
      openNodeIds,
    }
  }

  const currentNodeId = currentNode.nodeId
  openNodeIds[currentNodeId] = false
  visitedNodeIds[currentNodeId] = true

  if (currentNode.parent !== null && parents[currentNodeId] === null) {
    parents[currentNodeId] = currentNode.parent
  }

  if (currentNodeId === state.goalNodeId) {
    return {
      ...state,
      costs,
      currentNodeId: null,
      frontier: [],
      isComplete: true,
      isSolved: true,
      openNodeIds,
      parents,
      ...buildGraphTheoryPathState(state.graph, parents, state.startNodeId, state.goalNodeId),
      stepCount: state.stepCount + 1,
      visitedNodeIds,
    }
  }

  for (const neighbor of getGraphTheoryNeighbors(state.graph, currentNodeId)) {
    const nextCost =
      currentNode.cost +
      getGraphTheoryTraversalCost(
        state.graph,
        currentNodeId,
        neighbor.nodeId,
        neighbor.edgeCost,
      )

    if (nextCost >= costs[neighbor.nodeId]) {
      continue
    }

    costs[neighbor.nodeId] = nextCost
    parents[neighbor.nodeId] = currentNodeId
    openNodeIds[neighbor.nodeId] = true
    frontier.push({
      cost: nextCost,
      nodeId: neighbor.nodeId,
      parent: currentNodeId,
    })
  }

  return {
    ...state,
    costs,
    currentNodeId,
    frontier,
    isComplete: frontier.length === 0,
    openNodeIds,
    parents,
    stepCount: state.stepCount + 1,
    visitedNodeIds,
  }
}
