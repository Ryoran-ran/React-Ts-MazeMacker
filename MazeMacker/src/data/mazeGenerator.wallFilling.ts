import {
  cloneMaze,
  cloneVisited,
  createBorderOnlyGrid,
  createVisitedGrid,
  OPPOSITE_DIRECTION,
  shuffleDirections,
  type CellPosition,
  type MazeDimensions,
  type MazeGenerationState,
  type PendingWallEntry,
} from './mazeGenerator.shared'

function createPendingWalls(dimensions: MazeDimensions): PendingWallEntry[] {
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

  return pendingWalls.sort(() => Math.random() - 0.5)
}

function hasAlternatePath(
  state: MazeGenerationState,
  wall: PendingWallEntry,
): boolean {
  const queue: CellPosition[] = [{ ...wall.from }]
  const seen = Array.from({ length: state.dimensions.rows }, () =>
    Array.from({ length: state.dimensions.columns }, () => false),
  )

  seen[wall.from.y][wall.from.x] = true

  while (queue.length > 0) {
    const current = queue.shift() as CellPosition

    if (current.x === wall.to.x && current.y === wall.to.y) {
      return true
    }

    const directions = shuffleDirections()

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

  return false
}

export function createWallFillingState(
  dimensions: MazeDimensions,
): MazeGenerationState {
  return {
    algorithm: 'wallFilling',
    currentCell: null,
    dimensions,
    isComplete: false,
    extensionSegments: [],
    maze: createBorderOnlyGrid(dimensions),
    pendingPillars: [],
    pendingWalls: createPendingWalls(dimensions),
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

  while (pendingWalls.length > 0) {
    const nextWall = pendingWalls.shift()

    if (!nextWall) {
      break
    }

    if (!hasAlternatePath({ ...state, maze }, nextWall)) {
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
    visited,
  }
}
