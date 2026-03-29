import { type MazeCell, type MazeData } from '../components/MazeCanvas'

type Direction = 'top' | 'right' | 'bottom' | 'left'
export type MazeWallDirection = Direction
export type MazeCellKind = NonNullable<MazeCell['kind']>

type CellPosition = {
  x: number
  y: number
}

export type MazeDimensions = {
  columns: number
  rows: number
}

type StackEntry = CellPosition & {
  directions: Direction[]
}

export type MazeAlgorithm = 'digging'

export const MAZE_ALGORITHM_OPTIONS: Array<{
  label: string
  value: MazeAlgorithm
}> = [{ label: '穴掘り法', value: 'digging' }]

export type MazeGenerationState = {
  algorithm: MazeAlgorithm
  currentCell: CellPosition | null
  dimensions: MazeDimensions
  isComplete: boolean
  maze: MazeData
  stack: StackEntry[]
  stepCount: number
  visited: boolean[][]
}

export const DEFAULT_MAZE_DIMENSIONS: MazeDimensions = {
  columns: 20,
  rows: 20,
}

const DIRECTION_OFFSETS: Record<Direction, { dx: number; dy: number }> = {
  top: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  bottom: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
}

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
}

function createInitialGrid(dimensions: MazeDimensions): MazeData {
  return Array.from({ length: dimensions.rows }, (_, y) =>
    Array.from({ length: dimensions.columns }, (_, x): MazeCell => ({
      kind:
        y === 0 && x === 0
          ? 'start'
          : y === dimensions.rows - 1 && x === dimensions.columns - 1
            ? 'goal'
            : undefined,
      walls: {
        top: true,
        right: true,
        bottom: true,
        left: true,
      },
    })),
  )
}

function shuffleDirections(): Direction[] {
  const directions: Direction[] = ['top', 'right', 'bottom', 'left']

  for (let index = directions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = directions[index]
    directions[index] = directions[swapIndex]
    directions[swapIndex] = current
  }

  return directions
}

function isInBounds(x: number, y: number, dimensions: MazeDimensions) {
  return x >= 0 && x < dimensions.columns && y >= 0 && y < dimensions.rows
}

function cloneMaze(maze: MazeData): MazeData {
  return maze.map((row) =>
    row.map((cell) => ({
      kind: cell.kind,
      walls: { ...cell.walls },
    })),
  )
}

function cloneVisited(visited: boolean[][]): boolean[][] {
  return visited.map((row) => [...row])
}

function createVisitedGrid(dimensions: MazeDimensions): boolean[][] {
  return Array.from({ length: dimensions.rows }, () =>
    Array.from({ length: dimensions.columns }, () => false),
  )
}

export function createMazeGenerationState(
  dimensions: MazeDimensions = DEFAULT_MAZE_DIMENSIONS,
  algorithm: MazeAlgorithm = 'digging',
): MazeGenerationState {
  const maze = createInitialGrid(dimensions)
  const visited = createVisitedGrid(dimensions)

  visited[0][0] = true

  return {
    algorithm,
    currentCell: { x: 0, y: 0 },
    dimensions,
    isComplete: false,
    maze,
    stack: [{ x: 0, y: 0, directions: shuffleDirections() }],
    stepCount: 0,
    visited,
  }
}

export function stepMazeGeneration(
  state: MazeGenerationState,
): MazeGenerationState {
  if (state.algorithm !== 'digging') {
    return state
  }

  if (state.isComplete) {
    return state
  }

  const maze = cloneMaze(state.maze)
  const visited = cloneVisited(state.visited)
  const stack = state.stack.map((entry) => ({
    ...entry,
    directions: [...entry.directions],
  }))

  while (stack.length > 0) {
    const current = stack[stack.length - 1]

    while (current.directions.length > 0) {
      const direction = current.directions.pop() as Direction
      const { dx, dy } = DIRECTION_OFFSETS[direction]
      const nextX = current.x + dx
      const nextY = current.y + dy

      if (!isInBounds(nextX, nextY, state.dimensions) || visited[nextY][nextX]) {
        continue
      }

      maze[current.y][current.x].walls[direction] = false
      maze[nextY][nextX].walls[OPPOSITE_DIRECTION[direction]] = false
      visited[nextY][nextX] = true
      stack.push({
        x: nextX,
        y: nextY,
        directions: shuffleDirections(),
      })

      return {
        algorithm: state.algorithm,
        currentCell: { x: nextX, y: nextY },
        dimensions: state.dimensions,
        isComplete: false,
        maze,
        stack,
        stepCount: state.stepCount + 1,
        visited,
      }
    }

    stack.pop()

    return {
      algorithm: state.algorithm,
      currentCell:
        stack.length > 0
          ? { x: stack[stack.length - 1].x, y: stack[stack.length - 1].y }
          : null,
      dimensions: state.dimensions,
      isComplete: stack.length === 0,
      maze,
      stack,
      stepCount: state.stepCount + 1,
      visited,
    }
  }

  return {
    ...state,
    currentCell: null,
    isComplete: true,
  }
}

export function completeMazeGeneration(
  initialState: MazeGenerationState,
): MazeGenerationState {
  let state = initialState

  while (!state.isComplete) {
    state = stepMazeGeneration(state)
  }

  return state
}

export function toggleMazeWall(
  state: MazeGenerationState,
  position: CellPosition,
  direction: MazeWallDirection,
): MazeGenerationState {
  const maze = cloneMaze(state.maze)
  const visited = createVisitedGrid(state.dimensions)
  const { x, y } = position

  const nextValue = !maze[y][x].walls[direction]
  maze[y][x].walls[direction] = nextValue

  if (direction === 'top' && y > 0) {
    maze[y - 1][x].walls.bottom = nextValue
  }
  if (direction === 'right' && x < state.dimensions.columns - 1) {
    maze[y][x + 1].walls.left = nextValue
  }
  if (direction === 'bottom' && y < state.dimensions.rows - 1) {
    maze[y + 1][x].walls.top = nextValue
  }
  if (direction === 'left' && x > 0) {
    maze[y][x - 1].walls.right = nextValue
  }

  return {
    ...state,
    currentCell: null,
    isComplete: true,
    maze,
    stack: [],
    visited,
  }
}

export function setMazeCellKind(
  state: MazeGenerationState,
  position: CellPosition,
  kind: MazeCellKind,
): MazeGenerationState {
  const maze = cloneMaze(state.maze)
  const visited = createVisitedGrid(state.dimensions)

  for (let y = 0; y < state.dimensions.rows; y += 1) {
    for (let x = 0; x < state.dimensions.columns; x += 1) {
      if (maze[y][x].kind === kind) {
        maze[y][x].kind = undefined
      }
    }
  }

  maze[position.y][position.x].kind = kind

  return {
    ...state,
    currentCell: null,
    isComplete: true,
    maze,
    stack: [],
    visited,
  }
}
