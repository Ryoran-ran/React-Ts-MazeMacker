import { type MazeAlgorithm, type MazeDimensions } from './mazeGenerator'
import { type MazeTransferPayload } from './mazeTransfer.shared'
import { type MazeData } from '../components/MazeCanvas'

function padTimestampPart(value: number) {
  return String(value).padStart(2, '0')
}

function buildMazeExportTimestamp(date: Date) {
  return [
    date.getFullYear(),
    padTimestampPart(date.getMonth() + 1),
    padTimestampPart(date.getDate()),
    padTimestampPart(date.getHours()),
    padTimestampPart(date.getMinutes()),
    padTimestampPart(date.getSeconds()),
  ].join('')
}

export function buildMazeTransferPayload(
  maze: MazeData,
  dimensions: MazeDimensions,
  algorithm: MazeAlgorithm,
  seed?: number | null,
): MazeTransferPayload {
  return {
    algorithm,
    dimensions,
    maze,
    ...(seed === null || seed === undefined ? {} : { seed }),
  }
}

export function stringifyMazeTransferPayload(payload: MazeTransferPayload) {
  return JSON.stringify(payload, null, 2)
}

export function downloadMazeTransferPayload(
  payload: MazeTransferPayload,
  dimensions: MazeDimensions,
  algorithm: MazeAlgorithm,
) {
  const json = stringifyMazeTransferPayload(payload)
  const blob = new Blob([json], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  const fileName = `${buildMazeExportTimestamp(new Date())}_maze-${algorithm}-${dimensions.columns}x${dimensions.rows}.json`

  link.href = url
  link.download = fileName
  link.click()
  window.URL.revokeObjectURL(url)

  return json
}
