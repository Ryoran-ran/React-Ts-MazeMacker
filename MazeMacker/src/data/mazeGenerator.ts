import { type MazeCell, type MazeData } from '../components/MazeCanvas'

const GRID_SIZE = 20

type Direction = 'top' | 'right' | 'bottom' | 'left'

type CellPosition = {
  x: number
  y: number
}

type StackEntry = CellPosition & {
  directions: Direction[]
}

export type MazeGenerationState = {
  currentCell: CellPosition | null
  isComplete: boolean
  maze: MazeData
  stack: StackEntry[]
  stepCount: number
  visited: boolean[][]
}

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
  return Array.from({ length: GRID_SIZE }, (_, y) =>
    Array.from({ length: GRID_SIZE }, (_, x): MazeCell => ({
      kind:
        y === 0 && x === 0
          ? 'start'
          : y === GRID_SIZE - 1 && x === GRID_SIZE - 1
            ? 'goal'
            : undefined,
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

function cloneMaze(maze: MazeData): MazeData {
  return maze.map((row) =>
    row.map((cell) => ({
      kind: cell.kind,
      walls: { ...cell.walls },
    })),
  )
}

function cloneVisited(visited: boolean[][]): boolean[][] {
  return visited.map((row) => [...row])
}

export function createMazeGenerationState(): MazeGenerationState {
  const maze = createInitialGrid()
  const visited = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => false),
  )

  visited[0][0] = true

  return {
    currentCell: { x: 0, y: 0 },
    isComplete: false,
    maze,
    stack: [{ x: 0, y: 0, directions: shuffleDirections() }],
    stepCount: 0,
    visited,
  }
}

export function stepMazeGeneration(
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
      const direction = current.directions.pop() as Direction
      const { dx, dy } = DIRECTION_OFFSETS[direction]
      const nextX = current.x + dx
      const nextY = current.y + dy

      if (!isInBounds(nextX, nextY) || visited[nextY][nextX]) {
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
        currentCell: { x: nextX, y: nextY },
        isComplete: false,
        maze,
        stack,
        stepCount: state.stepCount + 1,
        visited,
      }
    }

    stack.pop()

    return {
      currentCell:
        stack.length > 0
          ? { x: stack[stack.length - 1].x, y: stack[stack.length - 1].y }
          : null,
      isComplete: stack.length === 0,
      maze,
      stack,
      stepCount: state.stepCount + 1,
      visited,
    }
  }

  return {
    ...state,
    currentCell: null,
    isComplete: true,
  }
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
