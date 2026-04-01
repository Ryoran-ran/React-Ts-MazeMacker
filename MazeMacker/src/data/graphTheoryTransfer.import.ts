import type { GraphTheoryData } from './graphTheory'
import type { GraphTheoryTransferPayload } from './graphTheoryTransfer.shared'

type GraphTheoryTransferImportErrors = {
  invalidJson: string
  invalidGraph: string
  invalidMarkers: string
}

function normalizeNodeIdMap(ids: number[]) {
  return new Map(ids.map((id, index) => [id, index]))
}

export function parseGraphTheoryTransferPayload(
  json: string,
  errors: GraphTheoryTransferImportErrors,
): GraphTheoryTransferPayload {
  let value: unknown

  try {
    value = JSON.parse(json)
  } catch {
    throw new Error(errors.invalidJson)
  }

  if (!value || typeof value !== 'object') {
    throw new Error(errors.invalidJson)
  }

  const payload = value as Partial<GraphTheoryTransferPayload>
  const graph = payload.graph

  if (!graph || typeof graph !== 'object' || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error(errors.invalidGraph)
  }

  if (graph.nodes.length < 2) {
    throw new Error(errors.invalidGraph)
  }

  let startCount = 0
  let goalCount = 0
  const sourceNodeIds: number[] = []

  for (const node of graph.nodes) {
    if (
      !node ||
      typeof node !== 'object' ||
      typeof node.id !== 'number' ||
      typeof node.cost !== 'number' ||
      typeof node.label !== 'string' ||
      !node.position ||
      typeof node.position !== 'object' ||
      typeof node.position.x !== 'number' ||
      typeof node.position.y !== 'number'
    ) {
      throw new Error(errors.invalidGraph)
    }

    if (node.kind !== undefined && node.kind !== 'start' && node.kind !== 'goal') {
      throw new Error(errors.invalidGraph)
    }

    sourceNodeIds.push(node.id)

    if (node.kind === 'start') {
      startCount += 1
    }

    if (node.kind === 'goal') {
      goalCount += 1
    }
  }

  if (startCount !== 1 || goalCount !== 1) {
    throw new Error(errors.invalidMarkers)
  }

  const nodeIndexById = normalizeNodeIdMap(sourceNodeIds)

  const normalizedNodes: GraphTheoryData['nodes'] = graph.nodes.map((node, index) => ({
    cost: Math.max(0, Math.trunc(node.cost)),
    id: index,
    kind: node.kind,
    label: node.label,
    position: {
      x: node.position.x,
      y: node.position.y,
    },
  }))

  const normalizedEdges: GraphTheoryData['edges'] = graph.edges.map((edge) => {
    if (
      !edge ||
      typeof edge !== 'object' ||
      typeof edge.from !== 'number' ||
      typeof edge.to !== 'number' ||
      typeof edge.cost !== 'number' ||
      (edge.direction !== 'undirected' &&
        edge.direction !== 'forward' &&
        edge.direction !== 'backward')
    ) {
      throw new Error(errors.invalidGraph)
    }

    const from = nodeIndexById.get(edge.from)
    const to = nodeIndexById.get(edge.to)

    if (from === undefined || to === undefined || from === to) {
      throw new Error(errors.invalidGraph)
    }

    return {
      cost: Math.max(0, Math.trunc(edge.cost)),
      direction: edge.direction,
      from,
      to,
    }
  })

  return {
    graph: {
      edges: normalizedEdges,
      nodes: normalizedNodes,
    },
  }
}
