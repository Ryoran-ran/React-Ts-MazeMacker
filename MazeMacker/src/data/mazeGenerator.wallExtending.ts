import {
  createEmptyGrid,
  createVisitedGrid,
  shuffleDirections,
  type CellPosition,
  type GridPosition,
  type MazeData,
  type MazeDimensions,
  type MazeGenerationState,
  type PillarEntry,
  type WallGrid,
} from './mazeGenerator.shared'

function createWallExtendingWallGrid(dimensions: MazeDimensions): WallGrid {
  return Array.from({ length: dimensions.rows * 2 + 1 }, (_, y) =>
    Array.from({ length: dimensions.columns * 2 + 1 }, (_, x) => {
      return (
        y === 0 ||
        x === 0 ||
        y === dimensions.rows * 2 ||
        x === dimensions.columns * 2
      )
    }),
  )
}

function createExtensionSeeds(dimensions: MazeDimensions): PillarEntry[] {
  const seeds: PillarEntry[] = []

  for (let y = 2; y < dimensions.rows * 2; y += 2) {
    for (let x = 2; x < dimensions.columns * 2; x += 2) {
      seeds.push({
        cell: {
          x: Math.max(0, x / 2 - 1),
          y: Math.max(0, y / 2 - 1),
        },
        gridX: x,
        gridY: y,
      })
    }
  }

  return seeds.sort(() => Math.random() - 0.5)
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

function markAffectedCells(
  visited: boolean[][],
  dimensions: MazeDimensions,
  gridX: number,
  gridY: number,
) {
  const cellX = Math.max(0, Math.min(dimensions.columns - 1, Math.floor((gridX - 1) / 2)))
  const cellY = Math.max(0, Math.min(dimensions.rows - 1, Math.floor((gridY - 1) / 2)))

  visited[cellY][cellX] = true

  if (cellX < dimensions.columns - 1) {
    visited[cellY][cellX + 1] = true
  }

  if (cellY < dimensions.rows - 1) {
    visited[cellY + 1][cellX] = true
  }

  if (cellX < dimensions.columns - 1 && cellY < dimensions.rows - 1) {
    visited[cellY + 1][cellX + 1] = true
  }
}

function deriveCurrentCell(
  dimensions: MazeDimensions,
  gridX: number,
  gridY: number,
): CellPosition {
  return {
    x: Math.max(0, Math.min(dimensions.columns - 1, gridX / 2 - 1)),
    y: Math.max(0, Math.min(dimensions.rows - 1, gridY / 2 - 1)),
  }
}

function applySegment(
  wallGrid: WallGrid,
  visited: boolean[][],
  dimensions: MazeDimensions,
  segment: GridPosition,
) {
  wallGrid[segment.y][segment.x] = true
  markAffectedCells(visited, dimensions, segment.x, segment.y)
}

function isMazeFullyConnected(maze: MazeData, dimensions: MazeDimensions): boolean {
  const queue: CellPosition[] = [{ x: 0, y: 0 }]
  const seen = Array.from({ length: dimensions.rows }, () =>
    Array.from({ length: dimensions.columns }, () => false),
  )
  seen[0][0] = true
  let visitedCount = 0

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current) {
      continue
    }

    visitedCount += 1
    const cell = maze[current.y][current.x]

    if (!cell.walls.top && current.y > 0 && !seen[current.y - 1][current.x]) {
      seen[current.y - 1][current.x] = true
      queue.push({ x: current.x, y: current.y - 1 })
    }
    if (
      !cell.walls.right &&
      current.x < dimensions.columns - 1 &&
      !seen[current.y][current.x + 1]
    ) {
      seen[current.y][current.x + 1] = true
      queue.push({ x: current.x + 1, y: current.y })
    }
    if (
      !cell.walls.bottom &&
      current.y < dimensions.rows - 1 &&
      !seen[current.y + 1][current.x]
    ) {
      seen[current.y + 1][current.x] = true
      queue.push({ x: current.x, y: current.y + 1 })
    }
    if (!cell.walls.left && current.x > 0 && !seen[current.y][current.x - 1]) {
      seen[current.y][current.x - 1] = true
      queue.push({ x: current.x - 1, y: current.y })
    }
  }

  return visitedCount === dimensions.columns * dimensions.rows
}

function buildExtensionSegments(
  wallGrid: WallGrid,
  seed: PillarEntry,
  dimensions: MazeDimensions,
): GridPosition[] | null {
  if (wallGrid[seed.gridY][seed.gridX]) {
    return null
  }

  let currentX = seed.gridX
  let currentY = seed.gridY
  let previousX = -1
  let previousY = -1
  const candidateSegments: GridPosition[] = [{ x: currentX, y: currentY }]
  const pathVisited = new Set<string>([`${currentX},${currentY}`])

  while (true) {
    const unconnectedMoves: Array<{
      intermediateX: number
      intermediateY: number
      nextX: number
      nextY: number
    }> = []
    const connectingMoves: Array<{
      intermediateX: number
      intermediateY: number
      nextX: number
      nextY: number
    }> = []

    for (const direction of shuffleDirections()) {
      let nextX = currentX
      let nextY = currentY

      if (direction === 'top') {
        nextY -= 2
      } else if (direction === 'right') {
        nextX += 2
      } else if (direction === 'bottom') {
        nextY += 2
      } else {
        nextX -= 2
      }

      if (
        nextX < 0 ||
        nextX >= dimensions.columns * 2 + 1 ||
        nextY < 0 ||
        nextY >= dimensions.rows * 2 + 1 ||
        (nextX === previousX && nextY === previousY) ||
        pathVisited.has(`${nextX},${nextY}`)
      ) {
        continue
      }

      const move = {
        intermediateX: (currentX + nextX) / 2,
        intermediateY: (currentY + nextY) / 2,
        nextX,
        nextY,
      }

      if (wallGrid[nextY][nextX]) {
        connectingMoves.push(move)
      } else {
        unconnectedMoves.push(move)
      }
    }

    const move = unconnectedMoves[0] ?? connectingMoves[0]

    if (!move) {
      return null
    }

    candidateSegments.push({ x: move.intermediateX, y: move.intermediateY })

    if (wallGrid[move.nextY][move.nextX]) {
      const nextWallGrid = wallGrid.map((row) => [...row])
      const nextVisited = createVisitedGrid(dimensions)

      for (const segment of candidateSegments) {
        applySegment(nextWallGrid, nextVisited, dimensions, segment)
      }

      const nextMaze = convertWallGridToMaze(dimensions, nextWallGrid)

      return isMazeFullyConnected(nextMaze, dimensions) ? candidateSegments : null
    }

    previousX = currentX
    previousY = currentY
    currentX = move.nextX
    currentY = move.nextY
    candidateSegments.push({ x: currentX, y: currentY })
    pathVisited.add(`${currentX},${currentY}`)
  }
}

export function createWallExtendingState(
  dimensions: MazeDimensions,
): MazeGenerationState {
  const wallGrid = createWallExtendingWallGrid(dimensions)

  return {
    algorithm: 'wallExtending',
    currentCell: null,
    dimensions,
    isComplete: false,
    extensionSegments: [],
    maze: convertWallGridToMaze(dimensions, wallGrid),
    pendingPillars: createExtensionSeeds(dimensions),
    pendingWalls: [],
    stack: [],
    stepCount: 0,
    visited: createVisitedGrid(dimensions),
    wallGrid,
  }
}

export function stepWallExtendingMazeGeneration(
  state: MazeGenerationState,
): MazeGenerationState {
  if (state.isComplete || !state.wallGrid) {
    return state
  }

  const wallGrid = state.wallGrid.map((row) => [...row])
  const visited = state.visited.map((row) => [...row])
  const pendingPillars = state.pendingPillars.slice()

  if (state.extensionSegments.length > 0) {
    const [nextSegment, ...remainingSegments] = state.extensionSegments

    applySegment(wallGrid, visited, state.dimensions, nextSegment)

    return {
      algorithm: state.algorithm,
      currentCell: deriveCurrentCell(state.dimensions, nextSegment.x, nextSegment.y),
      dimensions: state.dimensions,
      isComplete: remainingSegments.length === 0 && pendingPillars.length === 0,
      extensionSegments: remainingSegments,
      maze: convertWallGridToMaze(state.dimensions, wallGrid),
      pendingPillars,
      pendingWalls: [],
      stack: [],
      stepCount: state.stepCount + 1,
      visited,
      wallGrid,
    }
  }

  while (pendingPillars.length > 0) {
    const seed = pendingPillars.shift()

    if (!seed) {
      continue
    }
    const extensionSegments = buildExtensionSegments(wallGrid, seed, state.dimensions)

    if (!extensionSegments || extensionSegments.length === 0) {
      continue
    }

    const [nextSegment, ...remainingSegments] = extensionSegments
    applySegment(wallGrid, visited, state.dimensions, nextSegment)

    return {
      algorithm: state.algorithm,
      currentCell: deriveCurrentCell(state.dimensions, nextSegment.x, nextSegment.y),
      dimensions: state.dimensions,
      isComplete: remainingSegments.length === 0 && pendingPillars.length === 0,
      extensionSegments: remainingSegments,
      maze: convertWallGridToMaze(state.dimensions, wallGrid),
      pendingPillars,
      pendingWalls: [],
      stack: [],
      stepCount: state.stepCount + 1,
      visited,
      wallGrid,
    }
  }

  return {
    ...state,
    currentCell: null,
    isComplete: true,
    extensionSegments: [],
    pendingPillars: [],
    wallGrid,
    visited,
    maze: convertWallGridToMaze(state.dimensions, wallGrid),
  }
}
