import {
  MAZE_ALGORITHM_OPTIONS,
  normalizeMazeSeed,
  type MazeAlgorithm,
} from './mazeGenerator'
import { type MazeData } from '../components/MazeCanvas'
import { type MazeTransferPayload } from './mazeTransfer.shared'

type MazeTransferImportErrors = {
  dimensionMismatch: string
  invalidJson: string
  invalidMarkers: string
  invalidMaze: string
}

function isMazeAlgorithm(value: unknown): value is MazeAlgorithm {
  return MAZE_ALGORITHM_OPTIONS.some((algorithm) => algorithm.value === value)
}

export function parseMazeTransferPayload(
  json: string,
  errors: MazeTransferImportErrors,
): MazeTransferPayload {
  let value: unknown

  try {
    value = JSON.parse(json)
  } catch {
    throw new Error(errors.invalidJson)
  }

  if (!value || typeof value !== 'object') {
    throw new Error(errors.invalidJson)
  }

  const payload = value as Partial<MazeTransferPayload>

  if (!Array.isArray(payload.maze) || payload.maze.length === 0) {
    throw new Error(errors.invalidMaze)
  }

  const rowCount = payload.maze.length
  const columnCount = Array.isArray(payload.maze[0]) ? payload.maze[0].length : 0

  if (columnCount === 0) {
    throw new Error(errors.invalidMaze)
  }

  let startCount = 0
  let goalCount = 0

  for (const row of payload.maze) {
    if (!Array.isArray(row) || row.length !== columnCount) {
      throw new Error(errors.invalidMaze)
    }

    for (const cell of row) {
      if (!cell || typeof cell !== 'object' || !('walls' in cell)) {
        throw new Error(errors.invalidMaze)
      }

      const nextCell = cell as MazeData[number][number]

      if (
        !nextCell.walls ||
        typeof nextCell.walls !== 'object' ||
        typeof nextCell.walls.top !== 'boolean' ||
        typeof nextCell.walls.right !== 'boolean' ||
        typeof nextCell.walls.bottom !== 'boolean' ||
        typeof nextCell.walls.left !== 'boolean'
      ) {
        throw new Error(errors.invalidMaze)
      }

      if (
        nextCell.costs !== undefined &&
        (
          !nextCell.costs ||
          typeof nextCell.costs !== 'object' ||
          typeof nextCell.costs.top !== 'number' ||
          typeof nextCell.costs.right !== 'number' ||
          typeof nextCell.costs.bottom !== 'number' ||
          typeof nextCell.costs.left !== 'number'
        )
      ) {
        throw new Error(errors.invalidMaze)
      }

      if (
        nextCell.kind !== undefined &&
        nextCell.kind !== 'start' &&
        nextCell.kind !== 'goal'
      ) {
        throw new Error(errors.invalidMaze)
      }

      if (nextCell.kind === 'start') {
        startCount += 1
      }

      if (nextCell.kind === 'goal') {
        goalCount += 1
      }
    }
  }

  if (startCount !== 1 || goalCount !== 1) {
    throw new Error(errors.invalidMarkers)
  }

  if (
    payload.dimensions &&
    (payload.dimensions.columns !== columnCount || payload.dimensions.rows !== rowCount)
  ) {
    throw new Error(errors.dimensionMismatch)
  }

  return {
    algorithm: isMazeAlgorithm(payload.algorithm) ? payload.algorithm : undefined,
    dimensions: {
      columns: columnCount,
      rows: rowCount,
    },
    maze: payload.maze.map((row) =>
      row.map((cell) => ({
        kind: cell.kind,
        costs: {
          top: cell.costs?.top ?? 1,
          right: cell.costs?.right ?? 1,
          bottom: cell.costs?.bottom ?? 1,
          left: cell.costs?.left ?? 1,
        },
        walls: { ...cell.walls },
      })),
    ),
    seed: typeof payload.seed === 'number' ? normalizeMazeSeed(payload.seed) : undefined,
  }
}
