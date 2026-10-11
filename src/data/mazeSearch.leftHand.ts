import {
  buildPathGrid,
  getCellNeighbor,
  reverseDirection,
  turnLeft,
  turnRight,
  type MazeSearchState,
} from './mazeSearch.shared'

export function stepLeftHandSearch(state: MazeSearchState): MazeSearchState {
  const current = state.currentCell ?? state.start
  const openSet = state.maze.map((row) => row.map(() => false))
  const visited = state.visited.map((row) => [...row])
  const parents = state.parents.map((row) => [...row])
  const costs = state.costs.map((row) => [...row])
  const seenStates = [...state.seenStates]

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
      seenStates,
      stepCount: state.stepCount + 1,
      visited,
    }
  }

  visited[current.y][current.x] = true

  const directions = [
    turnLeft(state.currentDirection),
    state.currentDirection,
    turnRight(state.currentDirection),
    reverseDirection(state.currentDirection),
  ]

  for (const direction of directions) {
    if (state.maze[current.y][current.x].walls[direction]) {
      continue
    }

    const next = getCellNeighbor(state.maze, current, direction)

    if (!next) {
      continue
    }

    if (parents[next.y][next.x] === null) {
      parents[next.y][next.x] = current
    }

    const stateKey = `${next.x},${next.y},${direction}`

    if (seenStates.includes(stateKey)) {
      return {
        ...state,
        costs,
        currentCell: null,
        frontier: [],
        isComplete: true,
        openSet,
        parents,
        seenStates,
        stepCount: state.stepCount + 1,
        visited,
      }
    }

    seenStates.push(stateKey)
    openSet[next.y][next.x] = true

    return {
      ...state,
      costs,
      currentCell: next,
      currentDirection: direction,
      frontier: [{ cost: state.stepCount + 1, parent: current, position: next }],
      isComplete: false,
      openSet,
      parents,
      seenStates,
      stepCount: state.stepCount + 1,
      visited,
    }
  }

  return {
    ...state,
    costs,
    currentCell: null,
    frontier: [],
    isComplete: true,
    openSet,
    parents,
    seenStates,
    stepCount: state.stepCount + 1,
    visited,
  }
}
