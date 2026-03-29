import {
  createBooleanGrid,
  createParentGrid,
  getCellNeighbor,
  SEARCH_DIRECTIONS,
  type CellPosition,
  type MazeSearchState,
  type SearchNode,
} from './mazeSearch.shared'

function countRemainingNeighbors(
  state: MazeSearchState,
  visited: boolean[][],
  position: CellPosition,
) {
  let count = 0

  for (const direction of SEARCH_DIRECTIONS) {
    if (state.maze[position.y][position.x].walls[direction]) {
      continue
    }

    const next = getCellNeighbor(state.maze, position, direction)

    if (!next || visited[next.y][next.x]) {
      continue
    }

    count += 1
  }

  return count
}

function buildRemainingPath(
  state: MazeSearchState,
  visited: boolean[][],
) {
  const queue: SearchNode[] = [{ cost: 0, parent: null, position: state.start }]
  const seen = createBooleanGrid(state.maze)
  const parents = createParentGrid(state.maze)
  const path = createBooleanGrid(state.maze)

  seen[state.start.y][state.start.x] = true

  while (queue.length > 0) {
    const currentNode = queue.shift()

    if (!currentNode) {
      break
    }

    const current = currentNode.position

    if (current.x === state.goal.x && current.y === state.goal.y) {
      let cursor: CellPosition | null = current

      while (cursor) {
        path[cursor.y][cursor.x] = true

        if (cursor.x === state.start.x && cursor.y === state.start.y) {
          break
        }

        cursor = parents[cursor.y][cursor.x]
      }

      return path
    }

    for (const direction of SEARCH_DIRECTIONS) {
      if (state.maze[current.y][current.x].walls[direction]) {
        continue
      }

      const next = getCellNeighbor(state.maze, current, direction)

      if (!next || visited[next.y][next.x] || seen[next.y][next.x]) {
        continue
      }

      seen[next.y][next.x] = true
      parents[next.y][next.x] = current
      queue.push({
        cost: currentNode.cost + 1,
        parent: current,
        position: next,
      })
    }
  }

  return path
}

export function stepDeadEndFillingSearch(state: MazeSearchState): MazeSearchState {
  const frontier = [...state.frontier]
  const openSet = state.openSet.map((row) => [...row])
  const visited = state.visited.map((row) => [...row])
  const costs = state.costs.map((row) => [...row])
  const currentNode = frontier.shift()

  if (!currentNode) {
    return {
      ...state,
      costs,
      currentCell: null,
      frontier: [],
      isComplete: true,
      isSolved: true,
      openSet,
      path: buildRemainingPath(state, visited),
      stepCount: state.stepCount + 1,
      visited,
    }
  }

  const current = currentNode.position
  openSet[current.y][current.x] = false
  visited[current.y][current.x] = true

  for (const direction of SEARCH_DIRECTIONS) {
    if (state.maze[current.y][current.x].walls[direction]) {
      continue
    }

    const next = getCellNeighbor(state.maze, current, direction)

    if (!next || visited[next.y][next.x]) {
      continue
    }

    if (
      (next.x === state.start.x && next.y === state.start.y) ||
      (next.x === state.goal.x && next.y === state.goal.y)
    ) {
      continue
    }

    if (openSet[next.y][next.x]) {
      continue
    }

    if (countRemainingNeighbors(state, visited, next) <= 1) {
      openSet[next.y][next.x] = true
      frontier.push({
        cost: currentNode.cost + 1,
        parent: current,
        position: next,
      })
    }
  }

  return {
    ...state,
    costs,
    currentCell: current,
    frontier,
    isComplete: false,
    openSet,
    stepCount: state.stepCount + 1,
    visited,
  }
}
