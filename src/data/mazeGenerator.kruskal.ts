import {
  cloneMaze,
  cloneVisited,
  createInitialGrid,
  createVisitedGrid,
  OPPOSITE_DIRECTION,
  normalizeMazeSeed,
  shuffleEntries,
  type CellPosition,
  type MazeDimensions,
  type MazeGenerationState,
  type PendingWallEntry,
} from './mazeGenerator.shared'

function createKruskalCandidates(dimensions: MazeDimensions) {
  const candidates: PendingWallEntry[] = []

  for (let y = 0; y < dimensions.rows; y += 1) {
    for (let x = 0; x < dimensions.columns; x += 1) {
      if (x < dimensions.columns - 1) {
        candidates.push({
          direction: 'right',
          from: { x, y },
          to: { x: x + 1, y },
        })
      }

      if (y < dimensions.rows - 1) {
        candidates.push({
          direction: 'bottom',
          from: { x, y },
          to: { x, y: y + 1 },
        })
      }
    }
  }

  return candidates
}

function isSamePosition(left: CellPosition, right: CellPosition) {
  return left.x === right.x && left.y === right.y
}

function areCellsConnected(
  maze: MazeGenerationState['maze'],
  start: CellPosition,
  goal: CellPosition,
) {
  if (isSamePosition(start, goal)) {
    return true
  }

  const visited = maze.map((row) => row.map(() => false))
  const queue: CellPosition[] = [start]
  visited[start.y][start.x] = true

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current) {
      continue
    }

    const cell = maze[current.y][current.x]

    if (!cell.walls.top && current.y > 0 && !visited[current.y - 1][current.x]) {
      const next = { x: current.x, y: current.y - 1 }

      if (isSamePosition(next, goal)) {
        return true
      }

      visited[next.y][next.x] = true
      queue.push(next)
    }

    if (!cell.walls.right && current.x < maze[0].length - 1 && !visited[current.y][current.x + 1]) {
      const next = { x: current.x + 1, y: current.y }

      if (isSamePosition(next, goal)) {
        return true
      }

      visited[next.y][next.x] = true
      queue.push(next)
    }

    if (!cell.walls.bottom && current.y < maze.length - 1 && !visited[current.y + 1][current.x]) {
      const next = { x: current.x, y: current.y + 1 }

      if (isSamePosition(next, goal)) {
        return true
      }

      visited[next.y][next.x] = true
      queue.push(next)
    }

    if (!cell.walls.left && current.x > 0 && !visited[current.y][current.x - 1]) {
      const next = { x: current.x - 1, y: current.y }

      if (isSamePosition(next, goal)) {
        return true
      }

      visited[next.y][next.x] = true
      queue.push(next)
    }
  }

  return false
}

export function createKruskalState(
  dimensions: MazeDimensions,
  seed: number | null,
): MazeGenerationState {
  const maze = createInitialGrid(dimensions)
  const visited = createVisitedGrid(dimensions)
  const normalizedSeed = seed === null ? null : normalizeMazeSeed(seed)
  const shuffledCandidates = shuffleEntries(createKruskalCandidates(dimensions), normalizedSeed)

  return {
    algorithm: 'kruskal',
    currentCell: null,
    dimensions,
    isComplete: false,
    extensionSegments: [],
    maze,
    pendingPillars: [],
    pendingWalls: shuffledCandidates.entries,
    rngState: shuffledCandidates.rngState,
    seed: normalizedSeed,
    stack: [],
    stepCount: 0,
    visited,
    wallGrid: null,
  }
}

export function stepKruskalMazeGeneration(
  state: MazeGenerationState,
): MazeGenerationState {
  if (state.isComplete) {
    return state
  }

  const maze = cloneMaze(state.maze)
  const visited = cloneVisited(state.visited)
  const pendingWalls = state.pendingWalls.slice()

  while (pendingWalls.length > 0) {
    const wall = pendingWalls.shift()

    if (!wall) {
      continue
    }

    if (areCellsConnected(maze, wall.from, wall.to)) {
      continue
    }

    maze[wall.from.y][wall.from.x].walls[wall.direction] = false
    maze[wall.to.y][wall.to.x].walls[OPPOSITE_DIRECTION[wall.direction]] = false
    visited[wall.from.y][wall.from.x] = true
    visited[wall.to.y][wall.to.x] = true

    return {
      ...state,
      currentCell: wall.to,
      isComplete: pendingWalls.length === 0,
      maze,
      pendingWalls,
      stepCount: state.stepCount + 1,
      visited,
    }
  }

  return {
    ...state,
    currentCell: null,
    isComplete: true,
    pendingWalls: [],
    visited,
  }
}
