import {
  cloneMaze,
  cloneVisited,
  createInitialGrid,
  createVisitedGrid,
  DIRECTION_OFFSETS,
  isInBounds,
  OPPOSITE_DIRECTION,
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
): PendingWallEntry[] {
  const entries: PendingWallEntry[] = []

  for (const direction of shuffleDirections()) {
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

export function createPrimState(dimensions: MazeDimensions): MazeGenerationState {
  const maze = createInitialGrid(dimensions)
  const visited = createVisitedGrid(dimensions)
  visited[0][0] = true

  return {
    algorithm: 'prim',
    currentCell: { x: 0, y: 0 },
    dimensions,
    isComplete: false,
    extensionSegments: [],
    maze,
    pendingPillars: [],
    pendingWalls: createFrontierEntries({ x: 0, y: 0 }, dimensions, visited),
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

  while (pendingWalls.length > 0) {
    const wallIndex = Math.floor(Math.random() * pendingWalls.length)
    const [wall] = pendingWalls.splice(wallIndex, 1)

    if (visited[wall.to.y][wall.to.x]) {
      continue
    }

    maze[wall.from.y][wall.from.x].walls[wall.direction] = false
    maze[wall.to.y][wall.to.x].walls[OPPOSITE_DIRECTION[wall.direction]] = false
    visited[wall.to.y][wall.to.x] = true
    pendingWalls.push(...createFrontierEntries(wall.to, state.dimensions, visited))

    return {
      algorithm: state.algorithm,
      currentCell: wall.to,
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
    pendingWalls: [],
  }
}
