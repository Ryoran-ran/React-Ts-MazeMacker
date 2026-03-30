import { type MazeCell, type MazeData } from '../components/MazeCanvas'
export type { MazeData }

type Direction = 'top' | 'right' | 'bottom' | 'left'
export type MazeWallDirection = Direction
export type MazeCellKind = NonNullable<MazeCell['kind']>

export type CellPosition = {
  x: number
  y: number
}

export type MazeDimensions = {
  columns: number
  rows: number
}

export type StackEntry = CellPosition & {
  directions: Direction[]
}

export type WallGrid = boolean[][]

export type PillarEntry = {
  cell: CellPosition
  gridX: number
  gridY: number
}

export type PendingWallEntry = {
  direction: MazeWallDirection
  from: CellPosition
  to: CellPosition
}

export type GridPosition = {
  x: number
  y: number
}

export type MazeAlgorithm =
  | 'prim'
  | 'digging'
  | 'stickFalling'
  | 'wallFilling'
  | 'wallExtending'

export type MazeGenerationState = {
  algorithm: MazeAlgorithm
  currentCell: CellPosition | null
  dimensions: MazeDimensions
  isComplete: boolean
  maze: MazeData
  extensionSegments: GridPosition[]
  pendingPillars: PillarEntry[]
  pendingWalls: PendingWallEntry[]
  rngState: number | null
  seed: number | null
  stack: StackEntry[]
  stepCount: number
  visited: boolean[][]
  wallGrid: WallGrid | null
}

export const DEFAULT_MAZE_DIMENSIONS: MazeDimensions = {
  columns: 20,
  rows: 20,
}

export const DEFAULT_MAZE_SEED = 12345

export const DIRECTION_OFFSETS: Record<Direction, { dx: number; dy: number }> = {
  top: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  bottom: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
}

export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
}

export function createInitialGrid(dimensions: MazeDimensions): MazeData {
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

export function createEmptyGrid(dimensions: MazeDimensions): MazeData {
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

export function createBorderOnlyGrid(dimensions: MazeDimensions): MazeData {
  return Array.from({ length: dimensions.rows }, (_, y) =>
    Array.from({ length: dimensions.columns }, (_, x): MazeCell => ({
      kind:
        y === 0 && x === 0
          ? 'start'
          : y === dimensions.rows - 1 && x === dimensions.columns - 1
            ? 'goal'
            : undefined,
      walls: {
        top: y === 0,
        right: x === dimensions.columns - 1,
        bottom: y === dimensions.rows - 1,
        left: x === 0,
      },
    })),
  )
}

export function normalizeMazeSeed(seed: number) {
  const normalized = Math.trunc(seed) >>> 0

  return normalized === 0 ? 1 : normalized
}

export function nextRandomState(rngState: number) {
  let nextState = rngState >>> 0
  nextState ^= nextState << 13
  nextState ^= nextState >>> 17
  nextState ^= nextState << 5

  return nextState >>> 0
}

export function randomInt(max: number, rngState: number | null) {
  if (max <= 0) {
    return { rngState, value: 0 }
  }

  if (rngState === null) {
    return {
      rngState: null,
      value: Math.floor(Math.random() * max),
    }
  }

  const nextState = nextRandomState(rngState)

  return {
    rngState: nextState,
    value: Math.floor((nextState / 0x100000000) * max),
  }
}

export function shuffleDirections(rngState: number | null): {
  directions: Direction[]
  rngState: number | null
} {
  const directions: Direction[] = ['top', 'right', 'bottom', 'left']
  let nextState = rngState

  for (let index = directions.length - 1; index > 0; index -= 1) {
    const randomResult = randomInt(index + 1, nextState)
    const swapIndex = randomResult.value
    nextState = randomResult.rngState
    const current = directions[index]
    directions[index] = directions[swapIndex]
    directions[swapIndex] = current
  }

  return { directions, rngState: nextState }
}

export function shuffleEntries<T>(entries: T[], rngState: number | null) {
  const nextEntries = [...entries]
  let nextState = rngState

  for (let index = nextEntries.length - 1; index > 0; index -= 1) {
    const randomResult = randomInt(index + 1, nextState)
    const swapIndex = randomResult.value
    nextState = randomResult.rngState
    const current = nextEntries[index]
    nextEntries[index] = nextEntries[swapIndex]
    nextEntries[swapIndex] = current
  }

  return {
    entries: nextEntries,
    rngState: nextState,
  }
}

export function isInBounds(x: number, y: number, dimensions: MazeDimensions) {
  return x >= 0 && x < dimensions.columns && y >= 0 && y < dimensions.rows
}

export function cloneMaze(maze: MazeData): MazeData {
  return maze.map((row) =>
    row.map((cell) => ({
      kind: cell.kind,
      walls: { ...cell.walls },
    })),
  )
}

export function cloneVisited(visited: boolean[][]): boolean[][] {
  return visited.map((row) => [...row])
}

export function createVisitedGrid(dimensions: MazeDimensions): boolean[][] {
  return Array.from({ length: dimensions.rows }, () =>
    Array.from({ length: dimensions.columns }, () => false),
  )
}
