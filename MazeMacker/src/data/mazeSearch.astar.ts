import {
  buildPathGrid,
  calculateHeuristic,
  getCellNeighbor,
  shuffleDirections,
  type MazeSearchState,
  type SearchNode,
} from './mazeSearch.shared'

function takeNextNode(state: MazeSearchState, frontier: SearchNode[]) {
  while (frontier.length > 0) {
    let bestIndex = 0
    let bestHeuristic = calculateHeuristic(frontier[0].position, state.goal)
    let bestScore = frontier[0].cost + bestHeuristic

    for (let index = 1; index < frontier.length; index += 1) {
      const heuristic = calculateHeuristic(frontier[index].position, state.goal)
      const score = frontier[index].cost + heuristic

      if (score < bestScore || (score === bestScore && heuristic < bestHeuristic)) {
        bestIndex = index
        bestHeuristic = heuristic
        bestScore = score
      }
    }

    const [candidate] = frontier.splice(bestIndex, 1)

    if (candidate.cost <= state.costs[candidate.position.y][candidate.position.x]) {
      return candidate
    }
  }

  return undefined
}

export function stepAStarSearch(state: MazeSearchState): MazeSearchState {
  const frontier = [...state.frontier]
  const openSet = state.openSet.map((row) => [...row])
  const visited = state.visited.map((row) => [...row])
  const parents = state.parents.map((row) => [...row])
  const costs = state.costs.map((row) => [...row])
  const currentNode = takeNextNode(state, frontier)

  if (!currentNode) {
    return {
      ...state,
      costs,
      currentCell: null,
      frontier: [],
      isComplete: true,
      openSet,
    }
  }

  const current = currentNode.position
  openSet[current.y][current.x] = false
  visited[current.y][current.x] = true

  if (currentNode.parent && parents[current.y][current.x] === null) {
    parents[current.y][current.x] = currentNode.parent
  }

  if (current.x === state.goal.x && current.y === state.goal.y) {
    return {
      ...state,
      costs,
      currentCell: null,
      frontier: [],
      isComplete: true,
      isSolved: true,
      openSet,
      parents,
      path: buildPathGrid(state.maze, parents, state.start, state.goal),
      stepCount: state.stepCount + 1,
      visited,
    }
  }

  for (const direction of shuffleDirections()) {
    if (state.maze[current.y][current.x].walls[direction]) {
      continue
    }

    const next = getCellNeighbor(state.maze, current, direction)

    if (!next) {
      continue
    }

    const nextCost = currentNode.cost + 1

    if (nextCost >= costs[next.y][next.x]) {
      continue
    }

    costs[next.y][next.x] = nextCost
    parents[next.y][next.x] = current
    openSet[next.y][next.x] = true
    frontier.push({
      cost: nextCost,
      parent: current,
      position: next,
    })
  }

  return {
    ...state,
    costs,
    currentCell: current,
    frontier,
    isComplete: frontier.length === 0,
    openSet,
    parents,
    stepCount: state.stepCount + 1,
    visited,
  }
}
