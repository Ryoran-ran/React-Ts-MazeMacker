import {
  cloneVisited,
  createEmptyGrid,
  createVisitedGrid,
  DIRECTION_OFFSETS,
  shuffleDirections,
  type CellPosition,
  type MazeDimensions,
  type MazeGenerationState,
  type PillarEntry,
  type WallGrid,
} from './mazeGenerator.shared'

function createStickFallingWallGrid(dimensions: MazeDimensions): WallGrid {
  return Array.from({ length: dimensions.rows * 2 + 1 }, (_, y) =>
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
) {
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

export function createStickFallingState(
  dimensions: MazeDimensions,
): MazeGenerationState {
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
    pendingWalls: [],
    stack: [],
    stepCount: 0,
    visited,
    wallGrid,
  }
}

export function stepStickFallingMazeGeneration(
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

  const direction = availableDirections[0] ?? candidateDirections[0]

  if (!direction) {
    return {
      ...state,
      currentCell: pendingPillars[0]?.cell ?? null,
      isComplete: pendingPillars.length === 0,
      pendingPillars,
    }
  }

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
    pendingWalls: [],
    stack: [],
    stepCount: state.stepCount + 1,
    visited,
    wallGrid,
  }
}
