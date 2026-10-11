import { type MazeCell, type MazeData } from '../components/MazeCanvas'

const GRID_SIZE = 20

type Direction = 'top' | 'right' | 'bottom' | 'left'

const DIRECTION_OFFSETS: Record<Direction, { dx: number; dy: number }> = {
  top: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  bottom: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
}

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
}

function createInitialGrid(): MazeData {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, (): MazeCell => ({
      costs: {
        top: 1,
        right: 1,
        bottom: 1,
        left: 1,
      },
      walls: {
        top: true,
        right: true,
        bottom: true,
        left: true,
      },
    })),
  )
}

function shuffleDirections(): Direction[] {
  const directions: Direction[] = ['top', 'right', 'bottom', 'left']

  for (let index = directions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = directions[index]
    directions[index] = directions[swapIndex]
    directions[swapIndex] = current
  }

  return directions
}

function isInBounds(x: number, y: number) {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE
}

function carveMaze(
  maze: MazeData,
  visited: boolean[][],
  x: number,
  y: number,
) {
  visited[y][x] = true

  for (const direction of shuffleDirections()) {
    const { dx, dy } = DIRECTION_OFFSETS[direction]
    const nextX = x + dx
    const nextY = y + dy

    if (!isInBounds(nextX, nextY) || visited[nextY][nextX]) {
      continue
    }

    maze[y][x].walls[direction] = false
    maze[nextY][nextX].walls[OPPOSITE_DIRECTION[direction]] = false
    carveMaze(maze, visited, nextX, nextY)
  }
}

function createSampleMaze(): MazeData {
  const maze = createInitialGrid()
  const visited = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => false),
  )

  carveMaze(maze, visited, 0, 0)

  maze[0][0].walls.left = false
  maze[GRID_SIZE - 1][GRID_SIZE - 1].walls.right = false

  return maze
}

export const sampleMaze = createSampleMaze()
