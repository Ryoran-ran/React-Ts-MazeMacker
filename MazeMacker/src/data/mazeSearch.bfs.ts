import {
  buildPathGrid,
  getCellNeighbor,
  getMovementCost,
  shuffleDirections,
  type MazeSearchState,
} from './mazeSearch.shared'

export function stepBreadthFirstSearch(state: MazeSearchState): MazeSearchState {
  const frontier = [...state.frontier]
  const openSet = state.openSet.map((row) => [...row])
  const visited = state.visited.map((row) => [...row])
  const parents = state.parents.map((row) => [...row])
  const costs = state.costs.map((row) => [...row])
  let currentNode = frontier.shift()

  while (frontier.length > 0 && currentNode) {
    let bestIndex = -1

    for (let index = 0; index < frontier.length; index += 1) {
      if (
        frontier[index].cost <
        currentNode.cost
      ) {
        bestIndex = index
      }
    }

    if (bestIndex === -1) {
      break
    }

    frontier.unshift(currentNode)
    currentNode = frontier.splice(bestIndex, 1)[0]
  }

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

    if (!next || visited[next.y][next.x] || openSet[next.y][next.x]) {
      continue
    }

    const nextCost = currentNode.cost + getMovementCost(state.maze, current, direction)

    if (nextCost >= costs[next.y][next.x]) {
      continue
    }

    costs[next.y][next.x] = nextCost
    openSet[next.y][next.x] = true
    parents[next.y][next.x] = current
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
