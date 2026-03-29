import { SEARCH_DIRECTIONS, buildPathGrid, getCellNeighbor, type MazeSearchState } from './mazeSearch.shared'

export function stepDepthFirstSearch(state: MazeSearchState): MazeSearchState {
  const frontier = [...state.frontier]
  const openSet = state.openSet.map((row) => [...row])
  const visited = state.visited.map((row) => [...row])
  const parents = state.parents.map((row) => [...row])
  const costs = state.costs.map((row) => [...row])
  const currentNode = frontier[frontier.length - 1]

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

  for (const direction of SEARCH_DIRECTIONS) {
    if (state.maze[current.y][current.x].walls[direction]) {
      continue
    }

    const next = getCellNeighbor(state.maze, current, direction)

    if (!next || visited[next.y][next.x] || openSet[next.y][next.x]) {
      continue
    }

    parents[next.y][next.x] = current
    openSet[next.y][next.x] = true
    frontier.push({
      cost: currentNode.cost + 1,
      parent: current,
      position: next,
    })

    return {
      ...state,
      costs,
      currentCell: current,
      frontier,
      isComplete: false,
      openSet,
      parents,
      stepCount: state.stepCount + 1,
      visited,
    }
  }

  frontier.pop()
  openSet[current.y][current.x] = false
  visited[current.y][current.x] = true

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
