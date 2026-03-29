import { type MazeData, type MazeWallDirection } from '../components/MazeCanvas'

type CellPosition = {
  x: number
  y: number
}

type SearchNode = {
  parent: CellPosition | null
  position: CellPosition
}

export type MazeSearchAlgorithm = 'bfs' | 'dfs'

export type MazeSearchState = {
  algorithm: MazeSearchAlgorithm
  currentCell: CellPosition | null
  frontier: SearchNode[]
  isComplete: boolean
  isSolved: boolean
  maze: MazeData
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
  { label: '幅優先探索', value: 'bfs' },
  { label: '深さ優先探索', value: 'dfs' },
]

const SEARCH_DIRECTIONS: MazeWallDirection[] = ['top', 'right', 'bottom', 'left']

function createBooleanGrid(maze: MazeData) {
  return maze.map((row) => row.map(() => false))
}

function createParentGrid(maze: MazeData) {
  return maze.map((row) => row.map(() => null as CellPosition | null))
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

export function createMazeSearchState(
  maze: MazeData,
  algorithm: MazeSearchAlgorithm = 'bfs',
): MazeSearchState {
  const start = findCellByKind(maze, 'start') ?? { x: 0, y: 0 }
  const goal =
    findCellByKind(maze, 'goal') ??
    { x: maze[0].length - 1, y: maze.length - 1 }
  const visited = createBooleanGrid(maze)
  const parents = createParentGrid(maze)

  visited[start.y][start.x] = true

  if (start.x === goal.x && start.y === goal.y) {
    const path = createBooleanGrid(maze)
    path[start.y][start.x] = true

    return {
      algorithm,
      currentCell: null,
      frontier: [],
      isComplete: true,
      isSolved: true,
      maze,
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
    currentCell: null,
    frontier: [{ parent: null, position: start }],
    isComplete: false,
    isSolved: false,
    maze,
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

  const frontier = [...state.frontier]
  const visited = state.visited.map((row) => [...row])
  const parents = state.parents.map((row) => [...row])
  const currentNode =
    state.algorithm === 'dfs' ? frontier.pop() : frontier.shift()

  if (!currentNode) {
    return {
      ...state,
      currentCell: null,
      frontier: [],
      isComplete: true,
    }
  }

  const current = currentNode.position

  if (currentNode.parent && parents[current.y][current.x] === null) {
    parents[current.y][current.x] = currentNode.parent
  }

  if (current.x === state.goal.x && current.y === state.goal.y) {
    return {
      ...state,
      currentCell: null,
      frontier: [],
      isComplete: true,
      isSolved: true,
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

    if (!next || visited[next.y][next.x]) {
      continue
    }

    visited[next.y][next.x] = true
    parents[next.y][next.x] = current
    frontier.push({
      parent: current,
      position: next,
    })
  }

  return {
    ...state,
    currentCell: current,
    frontier,
    isComplete: frontier.length === 0,
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
