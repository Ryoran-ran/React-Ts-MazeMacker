import {
  buildGraphTheoryPathState,
  getGraphTheoryNeighbors,
  getGraphTheoryTraversalCost,
  type GraphTheorySearchState,
} from './graphTheorySearch.shared'

export function stepGraphTheoryDepthFirstSearch(
  state: GraphTheorySearchState,
): GraphTheorySearchState {
  const frontier = [...state.frontier]
  const openNodeIds = [...state.openNodeIds]
  const visitedNodeIds = [...state.visitedNodeIds]
  const parents = [...state.parents]
  const costs = [...state.costs]
  const currentNode = frontier[frontier.length - 1]

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

  const neighbors = getGraphTheoryNeighbors(state.graph, currentNodeId).sort((left, right) => {
    return left.nodeId - right.nodeId
  })

  for (const neighbor of neighbors) {
    if (visitedNodeIds[neighbor.nodeId] || openNodeIds[neighbor.nodeId]) {
      continue
    }

    parents[neighbor.nodeId] = currentNodeId
    costs[neighbor.nodeId] =
      currentNode.cost +
      getGraphTheoryTraversalCost(
        state.graph,
        currentNodeId,
        neighbor.nodeId,
        neighbor.edgeCost,
      )
    openNodeIds[neighbor.nodeId] = true
    frontier.push({
      cost: costs[neighbor.nodeId],
      nodeId: neighbor.nodeId,
      parent: currentNodeId,
    })

    return {
      ...state,
      costs,
      currentNodeId,
      frontier,
      isComplete: false,
      openNodeIds,
      parents,
      stepCount: state.stepCount + 1,
      visitedNodeIds,
    }
  }

  frontier.pop()
  openNodeIds[currentNodeId] = false
  visitedNodeIds[currentNodeId] = true

  return {
    ...state,
    costs,
    currentNodeId,
    frontier,
    isComplete: frontier.length === 0,
    openNodeIds,
    stepCount: state.stepCount + 1,
    visitedNodeIds,
    parents,
  }
}
