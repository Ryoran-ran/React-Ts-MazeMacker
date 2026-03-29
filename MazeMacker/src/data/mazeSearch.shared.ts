import { type MazeData, type MazeWallDirection } from '../components/MazeCanvas'

export type CellPosition = {
  x: number
  y: number
}

export type SearchNode = {
  cost: number
  parent: CellPosition | null
  position: CellPosition
}

export type MazeSearchAlgorithm =
  | 'astar'
  | 'bfs'
  | 'deadEndFilling'
  | 'dfs'
  | 'goalPruning'
  | 'leftHand'
  | 'tremaux'
  | 'rightHand'

export type MazeSearchState = {
  algorithm: MazeSearchAlgorithm
  costs: number[][]
  currentCell: CellPosition | null
  currentDirection: MazeWallDirection
  frontier: SearchNode[]
  isComplete: boolean
  isSolved: boolean
  maze: MazeData
  openSet: boolean[][]
  parents: Array<Array<CellPosition | null>>
  path: boolean[][]
  stepCount: number
  goal: CellPosition
  seenStates: string[]
  start: CellPosition
  visited: boolean[][]
}

export const MAZE_SEARCH_ALGORITHM_OPTIONS: Array<{
  label: string
  value: MazeSearchAlgorithm
}> = [
  { label: 'A*探索', value: 'astar' },
  { label: 'ダイクストラ法', value: 'bfs' },
  { label: 'Dead-End Filling', value: 'deadEndFilling' },
  { label: '深さ優先探索', value: 'dfs' },
  { label: '枝刈り探索', value: 'goalPruning' },
  { label: '左手探索法', value: 'leftHand' },
  { label: 'Trémaux法', value: 'tremaux' },
  { label: '右手探索法', value: 'rightHand' },
]

export const SEARCH_DIRECTIONS: MazeWallDirection[] = ['top', 'right', 'bottom', 'left']

export function createBooleanGrid(maze: MazeData) {
  return maze.map((row) => row.map(() => false))
}

export function createParentGrid(maze: MazeData) {
  return maze.map((row) => row.map(() => null as CellPosition | null))
}

export function createCostGrid(maze: MazeData) {
  return maze.map((row) => row.map(() => Number.POSITIVE_INFINITY))
}

export function shuffleDirections() {
  const directions = [...SEARCH_DIRECTIONS]

  for (let index = directions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = directions[index]
    directions[index] = directions[swapIndex]
    directions[swapIndex] = current
  }

  return directions
}

export function findCellByKind(
  maze: MazeData,
  kind: 'goal' | 'start',
): CellPosition | null {
  for (let y = 0; y < maze.length; y += 1) {
    for (let x = 0; x < maze[y].length; x += 1) {
      if (maze[y][x].kind === kind) {
        return { x, y }
      }
    }
  }

  return null
}

export function getCellNeighbor(
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

export function buildPathGrid(
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

export function calculateHeuristic(position: CellPosition, goal: CellPosition) {
  return Math.abs(goal.x - position.x) + Math.abs(goal.y - position.y)
}

export function turnRight(direction: MazeWallDirection): MazeWallDirection {
  if (direction === 'top') {
    return 'right'
  }
  if (direction === 'right') {
    return 'bottom'
  }
  if (direction === 'bottom') {
    return 'left'
  }

  return 'top'
}

export function turnLeft(direction: MazeWallDirection): MazeWallDirection {
  if (direction === 'top') {
    return 'left'
  }
  if (direction === 'left') {
    return 'bottom'
  }
  if (direction === 'bottom') {
    return 'right'
  }

  return 'top'
}

export function reverseDirection(direction: MazeWallDirection): MazeWallDirection {
  if (direction === 'top') {
    return 'bottom'
  }
  if (direction === 'right') {
    return 'left'
  }
  if (direction === 'bottom') {
    return 'top'
  }

  return 'right'
}

export function getInitialDirection(maze: MazeData, start: CellPosition): MazeWallDirection {
  for (const direction of SEARCH_DIRECTIONS) {
    if (!maze[start.y][start.x].walls[direction]) {
      return direction
    }
  }

  return 'right'
}

function countOpenNeighbors(maze: MazeData, position: CellPosition) {
  let count = 0

  for (const direction of SEARCH_DIRECTIONS) {
    if (maze[position.y][position.x].walls[direction]) {
      continue
    }

    if (getCellNeighbor(maze, position, direction)) {
      count += 1
    }
  }

  return count
}

export function createMazeSearchState(
  maze: MazeData,
  algorithm: MazeSearchAlgorithm = 'bfs',
): MazeSearchState {
  const start = findCellByKind(maze, 'start') ?? { x: 0, y: 0 }
  const goal =
    findCellByKind(maze, 'goal') ??
    { x: maze[0].length - 1, y: maze.length - 1 }
  const currentDirection = getInitialDirection(maze, start)
  const visited = createBooleanGrid(maze)
  const openSet = createBooleanGrid(maze)
  const parents = createParentGrid(maze)
  const costs = createCostGrid(maze)

  const isWallFollower =
    algorithm === 'rightHand' || algorithm === 'leftHand' || algorithm === 'tremaux'
  const frontier =
    algorithm === 'deadEndFilling'
      ? maze.flatMap((row, y) =>
          row.flatMap((_, x) => {
            if (
              (x === start.x && y === start.y) ||
              (x === goal.x && y === goal.y) ||
              countOpenNeighbors(maze, { x, y }) > 1
            ) {
              return []
            }

            openSet[y][x] = true
            return [{ cost: 0, parent: null, position: { x, y } }]
          }),
        )
      : [{ cost: 0, parent: null, position: start }]

  openSet[start.y][start.x] = isWallFollower
  costs[start.y][start.x] = algorithm === 'tremaux' ? 1 : 0

  if (start.x === goal.x && start.y === goal.y) {
    const path = createBooleanGrid(maze)
    path[start.y][start.x] = true
    visited[start.y][start.x] = true

    return {
      algorithm,
      costs,
      currentCell: null,
      currentDirection,
      frontier: [],
      isComplete: true,
      isSolved: true,
      maze,
      openSet,
      parents,
      path,
      stepCount: 0,
      goal,
      seenStates: [`${start.x},${start.y},${currentDirection}`],
      start,
      visited,
    }
  }

  return {
    algorithm,
    costs,
    currentCell: isWallFollower ? start : null,
    currentDirection,
    frontier,
    isComplete: false,
    isSolved: false,
    maze,
    openSet,
    parents,
    path: createBooleanGrid(maze),
    stepCount: 0,
    goal,
    seenStates: [`${start.x},${start.y},${currentDirection}`],
    start,
    visited,
  }
}

export function completeMazeSearch(
  initialState: MazeSearchState,
  stepMazeSearch: (state: MazeSearchState) => MazeSearchState,
): MazeSearchState {
  let state = initialState

  while (!state.isComplete) {
    state = stepMazeSearch(state)
  }

  return state
}
