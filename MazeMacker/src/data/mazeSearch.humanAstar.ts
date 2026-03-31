import {
  buildPathGrid,
  calculateHeuristic,
  createParentGrid,
  getCellNeighbor,
  getMovementCost,
  shuffleDirections,
  type CellPosition,
  type MazeSearchState,
  type SearchNode,
} from './mazeSearch.shared'

function isSamePosition(left: CellPosition, right: CellPosition) {
  return left.x === right.x && left.y === right.y
}

function canTravelThrough(
  state: MazeSearchState,
  position: CellPosition,
  target: CellPosition,
) {
  return (
    state.visited[position.y][position.x] ||
    state.openSet[position.y][position.x] ||
    isSamePosition(position, state.start) ||
    isSamePosition(position, state.currentCell ?? state.start) ||
    isSamePosition(position, target)
  )
}

function findTravelPath(
  state: MazeSearchState,
  from: CellPosition,
  to: CellPosition,
) {
  if (isSamePosition(from, to)) {
    return [from]
  }

  const frontier: SearchNode[] = [{ cost: 0, parent: null, position: from }]
  const parents = createParentGrid(state.maze)
  const costs = state.costs.map((row) => row.map(() => Number.POSITIVE_INFINITY))

  costs[from.y][from.x] = 0

  while (frontier.length > 0) {
    let bestIndex = 0
    let bestHeuristic = calculateHeuristic(frontier[0].position, to)
    let bestScore = frontier[0].cost + bestHeuristic

    for (let index = 1; index < frontier.length; index += 1) {
      const heuristic = calculateHeuristic(frontier[index].position, to)
      const score = frontier[index].cost + heuristic

      if (score < bestScore || (score === bestScore && heuristic < bestHeuristic)) {
        bestIndex = index
        bestHeuristic = heuristic
        bestScore = score
      }
    }

    const [currentNode] = frontier.splice(bestIndex, 1)
    const current = currentNode.position

    if (currentNode.cost > costs[current.y][current.x]) {
      continue
    }

    if (isSamePosition(current, to)) {
      const path: CellPosition[] = []
      let cursor: CellPosition | null = current

      while (cursor) {
        path.push(cursor)
        cursor = parents[cursor.y][cursor.x]
      }

      return path.reverse()
    }

    for (const direction of shuffleDirections()) {
      if (state.maze[current.y][current.x].walls[direction]) {
        continue
      }

      const next = getCellNeighbor(state.maze, current, direction)

      if (!next || !canTravelThrough(state, next, to)) {
        continue
      }

      const nextCost = currentNode.cost + getMovementCost(state.maze, current, direction)

      if (nextCost >= costs[next.y][next.x]) {
        continue
      }

      costs[next.y][next.x] = nextCost
      parents[next.y][next.x] = current
      frontier.push({
        cost: nextCost,
        parent: current,
        position: next,
      })
    }
  }

  return null
}

function chooseNextTarget(state: MazeSearchState) {
  const currentPosition = state.currentCell ?? state.start
  let bestIndex = -1
  let bestPath: CellPosition[] | null = null
  let bestNode: SearchNode | null = null
  let bestHeuristic = Number.POSITIVE_INFINITY
  let bestScore = Number.POSITIVE_INFINITY

  for (let index = 0; index < state.frontier.length; index += 1) {
    const candidate = state.frontier[index]

    if (candidate.cost > state.costs[candidate.position.y][candidate.position.x]) {
      continue
    }

    const travelPath = findTravelPath(state, currentPosition, candidate.position)

    if (!travelPath) {
      continue
    }

    const heuristic = calculateHeuristic(candidate.position, state.goal)
    const score = candidate.cost + heuristic

    if (score < bestScore || (score === bestScore && heuristic < bestHeuristic)) {
      bestIndex = index
      bestNode = candidate
      bestPath = travelPath
      bestScore = score
      bestHeuristic = heuristic
    }
  }

  return { bestIndex, bestNode, bestPath }
}

function expandTarget(state: MazeSearchState, targetNode: SearchNode): MazeSearchState {
  const frontier = [...state.frontier]
  const openSet = state.openSet.map((row) => [...row])
  const visited = state.visited.map((row) => [...row])
  const parents = state.parents.map((row) => [...row])
  const costs = state.costs.map((row) => [...row])
  const current = targetNode.position

  openSet[current.y][current.x] = false
  visited[current.y][current.x] = true

  if (targetNode.parent && parents[current.y][current.x] === null) {
    parents[current.y][current.x] = targetNode.parent
  }

  if (isSamePosition(current, state.goal)) {
    return {
      ...state,
      costs,
      currentCell: current,
      frontier: [],
      isComplete: true,
      isSolved: true,
      openSet,
      parents,
      path: buildPathGrid(state.maze, parents, state.start, state.goal),
      stepCount: state.stepCount + 1,
      targetNode: null,
      travelPath: [],
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

    const nextCost = targetNode.cost + getMovementCost(state.maze, current, direction)

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
    targetNode: null,
    travelPath: [],
    visited,
  }
}

export function stepHumanAStarSearch(state: MazeSearchState): MazeSearchState {
  if (state.currentCell === null) {
    return {
      ...state,
      currentCell: state.start,
    }
  }

  if (state.travelPath.length > 0) {
    const [nextPosition, ...remainingPath] = state.travelPath

    return {
      ...state,
      currentCell: nextPosition,
      stepCount: state.stepCount + 1,
      travelPath: remainingPath,
    }
  }

  if (state.targetNode) {
    return expandTarget(state, state.targetNode)
  }

  const { bestIndex, bestNode, bestPath } = chooseNextTarget(state)

  if (!bestNode || !bestPath) {
    return {
      ...state,
      currentCell: null,
      frontier: [],
      isComplete: true,
      targetNode: null,
      travelPath: [],
    }
  }

  const frontier = [...state.frontier]
  frontier.splice(bestIndex, 1)

  const travelPath = bestPath.slice(1)

  if (travelPath.length === 0) {
    return expandTarget(
      {
        ...state,
        frontier,
        targetNode: bestNode,
      },
      bestNode,
    )
  }

  const [nextPosition, ...remainingPath] = travelPath

  return {
    ...state,
    currentCell: nextPosition,
    frontier,
    stepCount: state.stepCount + 1,
    targetNode: bestNode,
    travelPath: remainingPath,
  }
}
