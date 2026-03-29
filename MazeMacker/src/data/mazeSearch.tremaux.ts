import {
  SEARCH_DIRECTIONS,
  getCellNeighbor,
  reverseDirection,
  type CellPosition,
  type MazeSearchState,
} from './mazeSearch.shared'
import { type MazeWallDirection } from '../components/MazeCanvas'

function getVisitMark(costs: number[][], position: CellPosition) {
  const cost = costs[position.y][position.x]
  return Number.isFinite(cost) ? cost : 0
}

function buildFrontierPathGrid(state: MazeSearchState) {
  const path = state.maze.map((row) => row.map(() => false))

  for (const node of state.frontier) {
    path[node.position.y][node.position.x] = true
  }

  return path
}

function getDirectionBetween(
  from: CellPosition,
  to: CellPosition,
): MazeWallDirection {
  if (to.y < from.y) {
    return 'top'
  }
  if (to.x > from.x) {
    return 'right'
  }
  if (to.y > from.y) {
    return 'bottom'
  }

  return 'left'
}

export function stepTremauxSearch(state: MazeSearchState): MazeSearchState {
  const frontier = [...state.frontier]
  const visited = state.visited.map((row) => [...row])
  const openSet = state.openSet.map((row) => row.map(() => false))
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
  costs[current.y][current.x] = Math.max(1, getVisitMark(costs, current))

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
      path: buildFrontierPathGrid({ ...state, frontier }),
      stepCount: state.stepCount + 1,
      visited,
    }
  }

  const previous = frontier.length > 1 ? frontier[frontier.length - 2].position : null
  const nextCandidates: Array<{ direction: MazeWallDirection; position: CellPosition }> = []

  for (const direction of SEARCH_DIRECTIONS) {
    if (state.maze[current.y][current.x].walls[direction]) {
      continue
    }

    const next = getCellNeighbor(state.maze, current, direction)

    if (!next) {
      continue
    }

    if (previous && next.x === previous.x && next.y === previous.y) {
      continue
    }

    nextCandidates.push({ direction, position: next })
  }

  nextCandidates.sort((left, right) => {
    const leftCost = getVisitMark(costs, left.position)
    const rightCost = getVisitMark(costs, right.position)

    if (leftCost !== rightCost) {
      return leftCost - rightCost
    }

    return SEARCH_DIRECTIONS.indexOf(left.direction) - SEARCH_DIRECTIONS.indexOf(right.direction)
  })

  const nextMove = nextCandidates.find(
    ({ position }) => getVisitMark(costs, position) < 2,
  )

  if (nextMove) {
    const next = nextMove.position
    const nextDirection = nextMove.direction

    if (parents[next.y][next.x] === null) {
      parents[next.y][next.x] = current
    }

    costs[next.y][next.x] = getVisitMark(costs, next) + 1
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
      currentDirection: nextDirection,
      frontier,
      isComplete: false,
      openSet,
      parents,
      stepCount: state.stepCount + 1,
      visited,
    }
  }

  costs[current.y][current.x] = Math.max(2, getVisitMark(costs, current))
  frontier.pop()

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

  const backtrackTo = frontier[frontier.length - 1].position
  const backtrackDirection = reverseDirection(getDirectionBetween(backtrackTo, current))

  for (const node of frontier) {
    openSet[node.position.y][node.position.x] = true
  }

  return {
    ...state,
    costs,
    currentCell: current,
    currentDirection: backtrackDirection,
    frontier,
    isComplete: false,
    openSet,
    parents,
    stepCount: state.stepCount + 1,
    visited,
  }
}
