import {
  buildPathGrid,
  getCellNeighbor,
  getMovementCost,
  shuffleDirections,
  type MazeSearchState,
  type SearchNode,
} from './mazeSearch.shared'

function takeNextNode(state: MazeSearchState, frontier: SearchNode[]) {
  while (frontier.length > 0) {
    let bestIndex = 0
    let bestCost = frontier[0].cost

    for (let index = 1; index < frontier.length; index += 1) {
      if (frontier[index].cost < bestCost) {
        bestIndex = index
        bestCost = frontier[index].cost
      }
    }

    const [candidate] = frontier.splice(bestIndex, 1)

    if (candidate.cost <= state.costs[candidate.position.y][candidate.position.x]) {
      return candidate
    }
  }

  return undefined
}

export function stepBreadthFirstSearch(state: MazeSearchState): MazeSearchState {
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

    const nextCost = currentNode.cost + getMovementCost(state.maze, current, direction)

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
