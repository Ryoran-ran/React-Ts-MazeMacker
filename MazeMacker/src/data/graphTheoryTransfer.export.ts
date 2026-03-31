import type { GraphTheoryTransferPayload } from './graphTheoryTransfer.shared'
import type { GraphTheoryData } from './graphTheory'

function padTimestampPart(value: number) {
  return String(value).padStart(2, '0')
}

function buildGraphTheoryExportTimestamp(date: Date) {
  return [
    date.getFullYear(),
    padTimestampPart(date.getMonth() + 1),
    padTimestampPart(date.getDate()),
    padTimestampPart(date.getHours()),
    padTimestampPart(date.getMinutes()),
    padTimestampPart(date.getSeconds()),
  ].join('')
}

export function buildGraphTheoryTransferPayload(
  graph: GraphTheoryData,
): GraphTheoryTransferPayload {
  return { graph }
}

export function stringifyGraphTheoryTransferPayload(payload: GraphTheoryTransferPayload) {
  return JSON.stringify(payload, null, 2)
}

export function downloadGraphTheoryTransferPayload(
  payload: GraphTheoryTransferPayload,
  vertexCount: number,
) {
  const json = stringifyGraphTheoryTransferPayload(payload)
  const blob = new Blob([json], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  const fileName = `${buildGraphTheoryExportTimestamp(new Date())}_graph-theory-${vertexCount}nodes.json`

  link.href = url
  link.download = fileName
  link.click()
  window.URL.revokeObjectURL(url)

  return json
}
