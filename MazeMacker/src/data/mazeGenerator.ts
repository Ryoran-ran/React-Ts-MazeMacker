import { createDiggingState, stepDiggingMazeGeneration } from './mazeGenerator.digging'
import {
  createStickFallingState,
  stepStickFallingMazeGeneration,
} from './mazeGenerator.stickFalling'
import {
  createWallFillingState,
  stepWallFillingMazeGeneration,
} from './mazeGenerator.wallFilling'
import {
  createWallExtendingState,
  stepWallExtendingMazeGeneration,
} from './mazeGenerator.wallExtending'
import {
  cloneMaze,
  createVisitedGrid,
  DEFAULT_MAZE_DIMENSIONS,
  type CellPosition,
  type MazeAlgorithm,
  type MazeCellKind,
  type MazeDimensions,
  type MazeGenerationState,
  type MazeWallDirection,
} from './mazeGenerator.shared'

export {
  DEFAULT_MAZE_DIMENSIONS,
  type MazeAlgorithm,
  type MazeCellKind,
  type MazeDimensions,
  type MazeGenerationState,
  type MazeWallDirection,
}

export const MAZE_ALGORITHM_OPTIONS: Array<{
  label: string
  value: MazeAlgorithm
}> = [
  { label: '穴掘り法', value: 'digging' },
  { label: '棒倒し法', value: 'stickFalling' },
  { label: '壁埋め法', value: 'wallFilling' },
  { label: '壁伸ばし法', value: 'wallExtending' },
]

export function createMazeGenerationState(
  dimensions: MazeDimensions = DEFAULT_MAZE_DIMENSIONS,
  algorithm: MazeAlgorithm = 'digging',
): MazeGenerationState {
  if (algorithm === 'stickFalling') {
    return createStickFallingState(dimensions)
  }

  if (algorithm === 'wallFilling') {
    return createWallFillingState(dimensions)
  }

  if (algorithm === 'wallExtending') {
    return createWallExtendingState(dimensions)
  }

  return createDiggingState(dimensions)
}

export function stepMazeGeneration(
  state: MazeGenerationState,
): MazeGenerationState {
  if (state.algorithm === 'stickFalling') {
    return stepStickFallingMazeGeneration(state)
  }

  if (state.algorithm === 'wallFilling') {
    return stepWallFillingMazeGeneration(state)
  }

  if (state.algorithm === 'wallExtending') {
    return stepWallExtendingMazeGeneration(state)
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
    extensionSegments: [],
    maze,
    pendingPillars: [],
    pendingWalls: [],
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
    extensionSegments: [],
    maze,
    pendingPillars: [],
    pendingWalls: [],
    stack: [],
    visited,
    wallGrid: null,
  }
}
