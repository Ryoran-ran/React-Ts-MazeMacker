import { type MazeCell, type MazeData } from '../components/MazeCanvas'

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

export type MazeAlgorithm = 'digging' | 'stickFalling'

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

export function shuffleDirections(): Direction[] {
  const directions: Direction[] = ['top', 'right', 'bottom', 'left']

  for (let index = directions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = directions[index]
    directions[index] = directions[swapIndex]
    directions[swapIndex] = current
  }

  return directions
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
