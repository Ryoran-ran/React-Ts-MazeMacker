import {
  cloneMaze,
  cloneVisited,
  createBorderOnlyGrid,
  createVisitedGrid,
  normalizeMazeSeed,
  OPPOSITE_DIRECTION,
  shuffleEntries,
  shuffleDirections,
  type CellPosition,
  type MazeDimensions,
  type MazeGenerationState,
  type PendingWallEntry,
} from './mazeGenerator.shared'

function createPendingWalls(dimensions: MazeDimensions, rngState: number | null) {
  const pendingWalls: PendingWallEntry[] = []

  for (let y = 0; y < dimensions.rows; y += 1) {
    for (let x = 0; x < dimensions.columns; x += 1) {
      if (x < dimensions.columns - 1) {
        pendingWalls.push({
          direction: 'right',
          from: { x, y },
          to: { x: x + 1, y },
        })
      }

      if (y < dimensions.rows - 1) {
        pendingWalls.push({
          direction: 'bottom',
          from: { x, y },
          to: { x, y: y + 1 },
        })
      }
    }
  }

  return shuffleEntries(pendingWalls, rngState)
}

function hasAlternatePath(
  state: MazeGenerationState,
  wall: PendingWallEntry,
): { hasPath: boolean; rngState: number | null } {
  const queue: CellPosition[] = [{ ...wall.from }]
  const seen = Array.from({ length: state.dimensions.rows }, () =>
    Array.from({ length: state.dimensions.columns }, () => false),
  )
  let rngState = state.rngState

  seen[wall.from.y][wall.from.x] = true

  while (queue.length > 0) {
    const current = queue.shift() as CellPosition

    if (current.x === wall.to.x && current.y === wall.to.y) {
        return { hasPath: true, rngState }
    }

    const shuffledDirections = shuffleDirections(rngState)
    const directions = shuffledDirections.directions
    rngState = shuffledDirections.rngState

    for (const direction of directions) {
      if (state.maze[current.y][current.x].walls[direction]) {
        continue
      }

      let next: CellPosition | null = null

      if (direction === 'top') {
        next = { x: current.x, y: current.y - 1 }
      } else if (direction === 'right') {
        next = { x: current.x + 1, y: current.y }
      } else if (direction === 'bottom') {
        next = { x: current.x, y: current.y + 1 }
      } else {
        next = { x: current.x - 1, y: current.y }
      }

      const isDirectEdgeForward =
        current.x === wall.from.x &&
        current.y === wall.from.y &&
        next.x === wall.to.x &&
        next.y === wall.to.y
      const isDirectEdgeBackward =
        current.x === wall.to.x &&
        current.y === wall.to.y &&
        next.x === wall.from.x &&
        next.y === wall.from.y

      if (isDirectEdgeForward || isDirectEdgeBackward) {
        continue
      }

      if (
        next.x < 0 ||
        next.x >= state.dimensions.columns ||
        next.y < 0 ||
        next.y >= state.dimensions.rows ||
        seen[next.y][next.x]
      ) {
        continue
      }

      seen[next.y][next.x] = true
      queue.push(next)
    }
  }

  return { hasPath: false, rngState }
}

export function createWallFillingState(
  dimensions: MazeDimensions,
  seed: number | null,
): MazeGenerationState {
  const normalizedSeed = seed === null ? null : normalizeMazeSeed(seed)
  const shuffledWalls = createPendingWalls(dimensions, normalizedSeed)

  return {
    algorithm: 'wallFilling',
    currentCell: null,
    dimensions,
    isComplete: false,
    extensionSegments: [],
    maze: createBorderOnlyGrid(dimensions),
    pendingPillars: [],
    pendingWalls: shuffledWalls.entries,
    rngState: shuffledWalls.rngState,
    seed: normalizedSeed,
    stack: [],
    stepCount: 0,
    visited: createVisitedGrid(dimensions),
    wallGrid: null,
  }
}

export function stepWallFillingMazeGeneration(
  state: MazeGenerationState,
): MazeGenerationState {
  if (state.isComplete) {
    return state
  }

  const pendingWalls = state.pendingWalls.slice()
  const maze = cloneMaze(state.maze)
  const visited = cloneVisited(state.visited)
  let rngState = state.rngState

  while (pendingWalls.length > 0) {
    const nextWall = pendingWalls.shift()

    if (!nextWall) {
      break
    }

    const alternatePathResult = hasAlternatePath({ ...state, maze, rngState }, nextWall)
    rngState = alternatePathResult.rngState

    if (!alternatePathResult.hasPath) {
      continue
    }

    maze[nextWall.from.y][nextWall.from.x].walls[nextWall.direction] = true
    maze[nextWall.to.y][nextWall.to.x].walls[OPPOSITE_DIRECTION[nextWall.direction]] = true
    visited[nextWall.from.y][nextWall.from.x] = true
    visited[nextWall.to.y][nextWall.to.x] = true

    return {
      algorithm: state.algorithm,
      currentCell: nextWall.from,
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
    maze,
    pendingWalls: [],
    rngState,
    visited,
  }
}
