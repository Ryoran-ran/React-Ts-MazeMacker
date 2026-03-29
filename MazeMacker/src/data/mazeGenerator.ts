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

type WallGrid = boolean[][]

type PillarEntry = {
  cell: CellPosition
  gridX: number
  gridY: number
}

export type MazeAlgorithm = 'digging' | 'stickFalling'

export const MAZE_ALGORITHM_OPTIONS: Array<{
  label: string
  value: MazeAlgorithm
}> = [
  { label: '穴掘り法', value: 'digging' },
  { label: '棒倒し法', value: 'stickFalling' },
]

export type MazeGenerationState = {
  algorithm: MazeAlgorithm
  currentCell: CellPosition | null
  dimensions: MazeDimensions
  isComplete: boolean
  maze: MazeData
  pendingPillars: PillarEntry[]
  stack: StackEntry[]
  stepCount: number
  visited: boolean[][]
  wallGrid: WallGrid | null
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

function createEmptyGrid(dimensions: MazeDimensions): MazeData {
  return Array.from({ length: dimensions.rows }, (_, y) =>
    Array.from({ length: dimensions.columns }, (_, x): MazeCell => ({
      kind:
        y === 0 && x === 0
          ? 'start'
          : y === dimensions.rows - 1 && x === dimensions.columns - 1
            ? 'goal'
            : undefined,
      walls: {
        top: false,
        right: false,
        bottom: false,
        left: false,
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

function createStickFallingWallGrid(dimensions: MazeDimensions): WallGrid {
  const wallGrid = Array.from({ length: dimensions.rows * 2 + 1 }, (_, y) =>
    Array.from({ length: dimensions.columns * 2 + 1 }, (_, x) => {
      const isBorder =
        y === 0 ||
        x === 0 ||
        y === dimensions.rows * 2 ||
        x === dimensions.columns * 2
      const isPillar =
        y > 0 &&
        y < dimensions.rows * 2 &&
        x > 0 &&
        x < dimensions.columns * 2 &&
        y % 2 === 0 &&
        x % 2 === 0

      return isBorder || isPillar
    }),
  )

  return wallGrid
}

function createStickFallingPillars(dimensions: MazeDimensions): PillarEntry[] {
  const pillars: PillarEntry[] = []

  for (let y = 2; y < dimensions.rows * 2; y += 2) {
    for (let x = 2; x < dimensions.columns * 2; x += 2) {
      pillars.push({
        cell: { x: x / 2 - 1, y: y / 2 - 1 },
        gridX: x,
        gridY: y,
      })
    }
  }

  return pillars
}

function convertWallGridToMaze(
  dimensions: MazeDimensions,
  wallGrid: WallGrid,
): MazeData {
  const maze = createEmptyGrid(dimensions)

  for (let y = 0; y < dimensions.rows; y += 1) {
    for (let x = 0; x < dimensions.columns; x += 1) {
      const gridX = x * 2 + 1
      const gridY = y * 2 + 1

      maze[y][x].walls.top = wallGrid[gridY - 1][gridX]
      maze[y][x].walls.right = wallGrid[gridY][gridX + 1]
      maze[y][x].walls.bottom = wallGrid[gridY + 1][gridX]
      maze[y][x].walls.left = wallGrid[gridY][gridX - 1]
    }
  }

  return maze
}

function createDiggingState(dimensions: MazeDimensions): MazeGenerationState {
  const maze = createInitialGrid(dimensions)
  const visited = createVisitedGrid(dimensions)

  visited[0][0] = true

  return {
    algorithm: 'digging',
    currentCell: { x: 0, y: 0 },
    dimensions,
    isComplete: false,
    maze,
    pendingPillars: [],
    stack: [{ x: 0, y: 0, directions: shuffleDirections() }],
    stepCount: 0,
    visited,
    wallGrid: null,
  }
}

function createStickFallingState(dimensions: MazeDimensions): MazeGenerationState {
  const wallGrid = createStickFallingWallGrid(dimensions)
  const visited = createVisitedGrid(dimensions)
  const pendingPillars = createStickFallingPillars(dimensions)

  return {
    algorithm: 'stickFalling',
    currentCell: pendingPillars[0]?.cell ?? null,
    dimensions,
    isComplete: pendingPillars.length === 0,
    maze: convertWallGridToMaze(dimensions, wallGrid),
    pendingPillars,
    stack: [],
    stepCount: 0,
    visited,
    wallGrid,
  }
}

function markStickFallingVisited(
  visited: boolean[][],
  dimensions: MazeDimensions,
  cell: CellPosition,
) {
  visited[cell.y][cell.x] = true

  if (cell.x === dimensions.columns - 2) {
    visited[cell.y][dimensions.columns - 1] = true
  }

  if (cell.y === dimensions.rows - 2) {
    visited[dimensions.rows - 1][cell.x] = true
  }

  if (cell.x === dimensions.columns - 2 && cell.y === dimensions.rows - 2) {
    visited[dimensions.rows - 1][dimensions.columns - 1] = true
  }
}

export function createMazeGenerationState(
  dimensions: MazeDimensions = DEFAULT_MAZE_DIMENSIONS,
  algorithm: MazeAlgorithm = 'digging',
): MazeGenerationState {
  if (algorithm === 'stickFalling') {
    return createStickFallingState(dimensions)
  }

  return createDiggingState(dimensions)
}

function stepDiggingMazeGeneration(state: MazeGenerationState): MazeGenerationState {
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
        pendingPillars: state.pendingPillars,
        stack,
        stepCount: state.stepCount + 1,
        visited,
        wallGrid: state.wallGrid,
      }
    }

    stack.pop()

    return {
      algorithm: state.algorithm,
      currentCell:
        stack.length > 0 ? { x: stack[stack.length - 1].x, y: stack[stack.length - 1].y } : null,
      dimensions: state.dimensions,
      isComplete: stack.length === 0,
      maze,
      pendingPillars: state.pendingPillars,
      stack,
      stepCount: state.stepCount + 1,
      visited,
      wallGrid: state.wallGrid,
    }
  }

  return {
    ...state,
    currentCell: null,
    isComplete: true,
  }
}

function stepStickFallingMazeGeneration(
  state: MazeGenerationState,
): MazeGenerationState {
  if (state.isComplete || !state.wallGrid) {
    return state
  }

  const pendingPillars = state.pendingPillars.slice()
  const currentPillar = pendingPillars.shift()

  if (!currentPillar) {
    return {
      ...state,
      currentCell: null,
      isComplete: true,
      pendingPillars,
    }
  }

  const wallGrid = state.wallGrid.map((row) => [...row])
  const visited = cloneVisited(state.visited)
  const candidateDirections =
    currentPillar.gridY === 2
      ? shuffleDirections()
      : shuffleDirections().filter((direction) => direction !== 'top')

  const availableDirections = candidateDirections.filter((direction) => {
    const { dx, dy } = DIRECTION_OFFSETS[direction]
    const nextX = currentPillar.gridX + dx
    const nextY = currentPillar.gridY + dy

    return !wallGrid[nextY][nextX]
  })

  const direction = (availableDirections[0] ?? candidateDirections[0]) as Direction
  const { dx, dy } = DIRECTION_OFFSETS[direction]
  wallGrid[currentPillar.gridY + dy][currentPillar.gridX + dx] = true
  markStickFallingVisited(visited, state.dimensions, currentPillar.cell)

  return {
    algorithm: state.algorithm,
    currentCell: pendingPillars[0]?.cell ?? null,
    dimensions: state.dimensions,
    isComplete: pendingPillars.length === 0,
    maze: convertWallGridToMaze(state.dimensions, wallGrid),
    pendingPillars,
    stack: [],
    stepCount: state.stepCount + 1,
    visited,
    wallGrid,
  }
}

export function stepMazeGeneration(
  state: MazeGenerationState,
): MazeGenerationState {
  if (state.algorithm === 'stickFalling') {
    return stepStickFallingMazeGeneration(state)
  }

  return stepDiggingMazeGeneration(state)
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
    pendingPillars: [],
    stack: [],
    visited,
    wallGrid: null,
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
    pendingPillars: [],
    stack: [],
    visited,
    wallGrid: null,
  }
}
