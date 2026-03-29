import {
  cloneMaze,
  cloneVisited,
  createInitialGrid,
  createVisitedGrid,
  DIRECTION_OFFSETS,
  isInBounds,
  OPPOSITE_DIRECTION,
  shuffleDirections,
  type MazeDimensions,
  type MazeGenerationState,
} from './mazeGenerator.shared'

export function createDiggingState(dimensions: MazeDimensions): MazeGenerationState {
  const maze = createInitialGrid(dimensions)
  const visited = createVisitedGrid(dimensions)

  visited[0][0] = true

  return {
    algorithm: 'digging',
    currentCell: { x: 0, y: 0 },
    dimensions,
    isComplete: false,
    extensionSegments: [],
    maze,
    pendingPillars: [],
    pendingWalls: [],
    stack: [{ x: 0, y: 0, directions: shuffleDirections() }],
    stepCount: 0,
    visited,
    wallGrid: null,
  }
}

export function stepDiggingMazeGeneration(
  state: MazeGenerationState,
): MazeGenerationState {
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
      const direction = current.directions.pop()

      if (!direction) {
        continue
      }

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
        extensionSegments: state.extensionSegments,
        maze,
        pendingPillars: state.pendingPillars,
        pendingWalls: state.pendingWalls,
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
      extensionSegments: state.extensionSegments,
      maze,
      pendingPillars: state.pendingPillars,
      pendingWalls: state.pendingWalls,
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
