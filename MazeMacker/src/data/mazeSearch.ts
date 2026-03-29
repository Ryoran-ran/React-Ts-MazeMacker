import { type MazeData, type MazeWallDirection } from '../components/MazeCanvas'

type CellPosition = {
  x: number
  y: number
}

type SearchNode = {
  cost: number
  parent: CellPosition | null
  position: CellPosition
}

export type MazeSearchAlgorithm = 'astar' | 'bfs' | 'dfs'

export type MazeSearchState = {
  algorithm: MazeSearchAlgorithm
  costs: number[][]
  currentCell: CellPosition | null
  frontier: SearchNode[]
  isComplete: boolean
  isSolved: boolean
  maze: MazeData
  openSet: boolean[][]
  parents: Array<Array<CellPosition | null>>
  path: boolean[][]
  stepCount: number
  goal: CellPosition
  start: CellPosition
  visited: boolean[][]
}

export const MAZE_SEARCH_ALGORITHM_OPTIONS: Array<{
  label: string
  value: MazeSearchAlgorithm
}> = [
  { label: 'A*探索', value: 'astar' },
  { label: 'ダイクストラ法', value: 'bfs' },
  { label: '深さ優先探索', value: 'dfs' },
]

const SEARCH_DIRECTIONS: MazeWallDirection[] = ['top', 'right', 'bottom', 'left']

function createBooleanGrid(maze: MazeData) {
  return maze.map((row) => row.map(() => false))
}

function createParentGrid(maze: MazeData) {
  return maze.map((row) => row.map(() => null as CellPosition | null))
}

function createCostGrid(maze: MazeData) {
  return maze.map((row) => row.map(() => Number.POSITIVE_INFINITY))
}

function shuffleDirections() {
  const directions = [...SEARCH_DIRECTIONS]

  for (let index = directions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = directions[index]
    directions[index] = directions[swapIndex]
    directions[swapIndex] = current
  }

  return directions
}

function findCellByKind(maze: MazeData, kind: 'goal' | 'start'): CellPosition | null {
  for (let y = 0; y < maze.length; y += 1) {
    for (let x = 0; x < maze[y].length; x += 1) {
      if (maze[y][x].kind === kind) {
        return { x, y }
      }
    }
  }

  return null
}

function getCellNeighbor(
  maze: MazeData,
  position: CellPosition,
  direction: MazeWallDirection,
): CellPosition | null {
  if (direction === 'top') {
    return position.y > 0 ? { x: position.x, y: position.y - 1 } : null
  }
  if (direction === 'right') {
    return position.x < maze[0].length - 1 ? { x: position.x + 1, y: position.y } : null
  }
  if (direction === 'bottom') {
    return position.y < maze.length - 1 ? { x: position.x, y: position.y + 1 } : null
  }

  return position.x > 0 ? { x: position.x - 1, y: position.y } : null
}

function buildPathGrid(
  maze: MazeData,
  parents: Array<Array<CellPosition | null>>,
  start: CellPosition,
  goal: CellPosition,
) {
  const path = createBooleanGrid(maze)
  let current: CellPosition | null = goal

  while (current) {
    path[current.y][current.x] = true

    if (current.x === start.x && current.y === start.y) {
      break
    }

    current = parents[current.y][current.x]
  }

  return path
}

function calculateHeuristic(position: CellPosition, goal: CellPosition) {
  return Math.abs(goal.x - position.x) + Math.abs(goal.y - position.y)
}

function stepDepthFirstSearch(state: MazeSearchState): MazeSearchState {
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

function takeNextNode(state: MazeSearchState, frontier: SearchNode[]) {
  if (state.algorithm === 'bfs') {
    return frontier.shift()
  }

  while (frontier.length > 0) {
    let bestIndex = 0
    let bestHeuristic = calculateHeuristic(frontier[0].position, state.goal)
    let bestScore = frontier[0].cost + bestHeuristic

    for (let index = 1; index < frontier.length; index += 1) {
      const heuristic = calculateHeuristic(frontier[index].position, state.goal)
      const score = frontier[index].cost + heuristic

      if (
        score < bestScore ||
        (score === bestScore && heuristic < bestHeuristic)
      ) {
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

export function createMazeSearchState(
  maze: MazeData,
  algorithm: MazeSearchAlgorithm = 'bfs',
): MazeSearchState {
  const start = findCellByKind(maze, 'start') ?? { x: 0, y: 0 }
  const goal =
    findCellByKind(maze, 'goal') ??
    { x: maze[0].length - 1, y: maze.length - 1 }
  const visited = createBooleanGrid(maze)
  const openSet = createBooleanGrid(maze)
  const parents = createParentGrid(maze)
  const costs = createCostGrid(maze)

  openSet[start.y][start.x] = true
  costs[start.y][start.x] = 0

  if (start.x === goal.x && start.y === goal.y) {
    const path = createBooleanGrid(maze)
    path[start.y][start.x] = true
    visited[start.y][start.x] = true

    return {
      algorithm,
      costs,
      currentCell: null,
      frontier: [],
      isComplete: true,
      isSolved: true,
      maze,
      openSet,
      parents,
      path,
      stepCount: 0,
      goal,
      start,
      visited,
    }
  }

  return {
    algorithm,
    costs,
    currentCell: null,
    frontier: [{ cost: 0, parent: null, position: start }],
    isComplete: false,
    isSolved: false,
    maze,
    openSet,
    parents,
    path: createBooleanGrid(maze),
    stepCount: 0,
    goal,
    start,
    visited,
  }
}

export function stepMazeSearch(state: MazeSearchState): MazeSearchState {
  if (state.isComplete) {
    return state
  }

  if (state.algorithm === 'dfs') {
    return stepDepthFirstSearch(state)
  }

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

    if (state.algorithm === 'astar') {
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
      continue
    }

    if (visited[next.y][next.x] || openSet[next.y][next.x]) {
      continue
    }

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

export function completeMazeSearch(initialState: MazeSearchState): MazeSearchState {
  let state = initialState

  while (!state.isComplete) {
    state = stepMazeSearch(state)
  }

  return state
}
