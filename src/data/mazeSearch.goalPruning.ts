import {
  calculateHeuristic,
  getCellNeighbor,
  SEARCH_DIRECTIONS,
  type CellPosition,
  type MazeSearchState,
} from './mazeSearch.shared'

function buildFrontierPathGrid(state: MazeSearchState, frontier = state.frontier) {
  const path = state.maze.map((row) => row.map(() => false))

  for (const node of frontier) {
    path[node.position.y][node.position.x] = true
  }

  return path
}

function canReachGoal(
  state: MazeSearchState,
  visited: boolean[][],
  frontier: MazeSearchState['frontier'],
  from: CellPosition,
) {
  const allowed = new Set(frontier.map((node) => `${node.position.x},${node.position.y}`))
  const seen = state.maze.map((row) => row.map(() => false))
  const queue: CellPosition[] = [from]

  seen[from.y][from.x] = true

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current) {
      break
    }

    if (current.x === state.goal.x && current.y === state.goal.y) {
      return true
    }

    for (const direction of SEARCH_DIRECTIONS) {
      if (state.maze[current.y][current.x].walls[direction]) {
        continue
      }

      const next = getCellNeighbor(state.maze, current, direction)

      if (!next || seen[next.y][next.x]) {
        continue
      }

      const isBlocked =
        visited[next.y][next.x] &&
        !allowed.has(`${next.x},${next.y}`) &&
        !(next.x === state.goal.x && next.y === state.goal.y)

      if (isBlocked) {
        continue
      }

      seen[next.y][next.x] = true
      queue.push(next)
    }
  }

  return false
}

export function stepGoalPruningSearch(state: MazeSearchState): MazeSearchState {
  const frontier = [...state.frontier]
  const openSet = state.openSet.map((row) => row.map(() => false))
  const visited = state.visited.map((row) => [...row])
  const parents = state.parents.map((row) => [...row])
  const costs = state.costs.map((row) => [...row])

  if (frontier.length === 0) {
    return {
      ...state,
      costs,
      currentCell: null,
      frontier: [],
      isComplete: true,
      openSet,
      parents,
      stepCount: state.stepCount + 1,
      visited,
    }
  }

  const current = frontier[frontier.length - 1].position
  visited[current.y][current.x] = true

  if (current.x === state.goal.x && current.y === state.goal.y) {
    for (const node of frontier) {
      openSet[node.position.y][node.position.x] = true
    }

    return {
      ...state,
      costs,
      currentCell: null,
      frontier: [],
      isComplete: true,
      isSolved: true,
      openSet,
      parents,
      path: buildFrontierPathGrid(state, frontier),
      stepCount: state.stepCount + 1,
      visited,
    }
  }

  const nextCandidates = SEARCH_DIRECTIONS.flatMap((direction) => {
    if (state.maze[current.y][current.x].walls[direction]) {
      return []
    }

    const next = getCellNeighbor(state.maze, current, direction)

    if (!next || visited[next.y][next.x]) {
      return []
    }

    if (frontier.some((node) => node.position.x === next.x && node.position.y === next.y)) {
      return []
    }

    return [{ direction, position: next }]
  })

  nextCandidates.sort((left, right) => {
    const leftScore = calculateHeuristic(left.position, state.goal)
    const rightScore = calculateHeuristic(right.position, state.goal)

    if (leftScore !== rightScore) {
      return leftScore - rightScore
    }

    return SEARCH_DIRECTIONS.indexOf(left.direction) - SEARCH_DIRECTIONS.indexOf(right.direction)
  })

  const nextMove = nextCandidates.find(({ position }) =>
    canReachGoal(state, visited, frontier, position),
  )

  if (nextMove) {
    const next = nextMove.position
    costs[next.y][next.x] = frontier.length

    if (parents[next.y][next.x] === null) {
      parents[next.y][next.x] = current
    }

    frontier.push({
      cost: frontier.length,
      parent: current,
      position: next,
    })

    for (const node of frontier) {
      openSet[node.position.y][node.position.x] = true
    }

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

  for (const node of frontier) {
    openSet[node.position.y][node.position.x] = true
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
