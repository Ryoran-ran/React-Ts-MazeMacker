import {
  cloneMaze,
  cloneVisited,
  createInitialGrid,
  createVisitedGrid,
  DIRECTION_OFFSETS,
  isInBounds,
  normalizeMazeSeed,
  OPPOSITE_DIRECTION,
  randomInt,
  shuffleDirections,
  type CellPosition,
  type MazeDimensions,
  type MazeGenerationState,
  type MazeWallDirection,
  type PendingWallEntry,
} from './mazeGenerator.shared'

function createFrontierEntries(
  position: CellPosition,
  dimensions: MazeDimensions,
  visited: boolean[][],
  rngState: number | null,
): PendingWallEntry[] {
  const entries: PendingWallEntry[] = []
  const shuffledDirections = shuffleDirections(rngState)

  for (const direction of shuffledDirections.directions) {
    const { dx, dy } = DIRECTION_OFFSETS[direction]
    const nextX = position.x + dx
    const nextY = position.y + dy

    if (!isInBounds(nextX, nextY, dimensions) || visited[nextY][nextX]) {
      continue
    }

    entries.push({
      direction: direction as MazeWallDirection,
      from: position,
      to: { x: nextX, y: nextY },
    })
  }

  return entries
}

export function createPrimState(
  dimensions: MazeDimensions,
  seed: number | null,
): MazeGenerationState {
  const maze = createInitialGrid(dimensions)
  const visited = createVisitedGrid(dimensions)
  const normalizedSeed = seed === null ? null : normalizeMazeSeed(seed)
  visited[0][0] = true

  return {
    algorithm: 'prim',
    currentCell: { x: 0, y: 0 },
    dimensions,
    isComplete: false,
    extensionSegments: [],
    maze,
    pendingPillars: [],
    pendingWalls: createFrontierEntries({ x: 0, y: 0 }, dimensions, visited, normalizedSeed),
    rngState: normalizedSeed,
    seed: normalizedSeed,
    stack: [],
    stepCount: 0,
    visited,
    wallGrid: null,
  }
}

export function stepPrimMazeGeneration(
  state: MazeGenerationState,
): MazeGenerationState {
  if (state.isComplete) {
    return state
  }

  const maze = cloneMaze(state.maze)
  const visited = cloneVisited(state.visited)
  const pendingWalls = state.pendingWalls.slice()
  let rngState = state.rngState

  while (pendingWalls.length > 0) {
    const randomResult = randomInt(pendingWalls.length, rngState)
    const wallIndex = randomResult.value
    rngState = randomResult.rngState
    const [wall] = pendingWalls.splice(wallIndex, 1)

    if (visited[wall.to.y][wall.to.x]) {
      continue
    }

    maze[wall.from.y][wall.from.x].walls[wall.direction] = false
    maze[wall.to.y][wall.to.x].walls[OPPOSITE_DIRECTION[wall.direction]] = false
    visited[wall.to.y][wall.to.x] = true
    pendingWalls.push(...createFrontierEntries(wall.to, state.dimensions, visited, rngState))

    return {
      algorithm: state.algorithm,
      currentCell: wall.to,
      dimensions: state.dimensions,
      isComplete: pendingWalls.length === 0,
      extensionSegments: state.extensionSegments,
      maze,
      pendingPillars: [],
      pendingWalls,
      rngState,
      seed: state.seed,
      stack: [],
      stepCount: state.stepCount + 1,
      visited,
      wallGrid: null,
    }
  }

  return {
    ...state,
    currentCell: null,
    isComplete: true,
    pendingWalls: [],
  }
}
