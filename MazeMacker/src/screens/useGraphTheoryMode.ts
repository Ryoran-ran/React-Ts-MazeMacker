import { useEffect, useState } from 'react'
import {
  GRAPH_THEORY_SEARCH_ALGORITHM_OPTIONS,
  completeGraphTheorySearch,
  createGraphTheorySearchState,
  stepGraphTheorySearch,
  type GraphTheorySearchAlgorithm,
  type GraphTheorySearchState,
} from '../data/graphTheorySearch'
import {
  addGraphTheoryEdge,
  cycleGraphTheoryEdgeDirection,
  createDefaultGraphTheoryData,
  resizeGraphTheoryData,
  setAllGraphTheoryEdgeCosts,
  setAllGraphTheoryNodeCosts,
  setGraphTheoryEdgeCost,
  setGraphTheoryNodeKind,
  setGraphTheoryNodeCost,
  setGraphTheoryNodeLabel,
  setGraphTheoryNodePosition,
  type GraphTheoryData,
} from '../data/graphTheory'

const MIN_EDGE_COST = 0
const MAX_EDGE_COST = 99
const MIN_GRAPH_VERTEX_COUNT = 2
const MAX_GRAPH_VERTEX_COUNT = 24

type GraphTheorySearchStateMap = Record<GraphTheorySearchAlgorithm, GraphTheorySearchState>

function createGraphTheorySearchStateMap(
  graph: GraphTheoryData,
): GraphTheorySearchStateMap {
  return {
    astar: createGraphTheorySearchState(graph, 'astar'),
    dfs: createGraphTheorySearchState(graph, 'dfs'),
    dijkstra: createGraphTheorySearchState(graph, 'dijkstra'),
  }
}

function normalizeGraphVertexCount(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) {
    return fallback
  }

  return Math.min(MAX_GRAPH_VERTEX_COUNT, Math.max(MIN_GRAPH_VERTEX_COUNT, parsed))
}

function normalizeEdgeCost(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) {
    return fallback
  }

  return Math.min(MAX_EDGE_COST, Math.max(MIN_EDGE_COST, parsed))
}

export function getSolvedGraphPathCost(searchState: GraphTheorySearchState) {
  if (!searchState.isSolved) {
    return null
  }

  const solvedCost = searchState.costs[searchState.goalNodeId]

  return Number.isFinite(solvedCost) ? solvedCost : null
}

export function useGraphTheoryMode() {
  const [selectedGraphSearchAlgorithms, setSelectedGraphSearchAlgorithms] = useState<
    GraphTheorySearchAlgorithm[]
  >(['astar'])
  const [graphEdgeCostInput, setGraphEdgeCostInput] = useState('1')
  const [graphNodeLabelInput, setGraphNodeLabelInput] = useState('1')
  const [graphNodeCostInput, setGraphNodeCostInput] = useState('1')
  const [graphVertexCountInput, setGraphVertexCountInput] = useState('7')
  const [graphTheoryState, setGraphTheoryState] = useState<GraphTheoryData>(() =>
    createDefaultGraphTheoryData(7),
  )
  const [graphSearchStates, setGraphSearchStates] = useState<GraphTheorySearchStateMap>(() =>
    createGraphTheorySearchStateMap(createDefaultGraphTheoryData(7)),
  )

  useEffect(() => {
    setGraphSearchStates(createGraphTheorySearchStateMap(graphTheoryState))
  }, [graphTheoryState])

  function handleGraphTheoryEdgeCostSet(edgeIndex: number, nextCost: number) {
    setGraphTheoryState((currentGraph) =>
      setGraphTheoryEdgeCost(currentGraph, edgeIndex, nextCost),
    )
  }

  function handleGraphTheoryNodeCostSet(nodeIndex: number, nextCost: number) {
    setGraphTheoryState((currentGraph) =>
      setGraphTheoryNodeCost(currentGraph, nodeIndex, nextCost),
    )
  }

  function handleGraphTheoryNodeLabelSet(nodeIndex: number, nextLabel: string) {
    setGraphTheoryState((currentGraph) =>
      setGraphTheoryNodeLabel(currentGraph, nodeIndex, nextLabel),
    )
  }

  function handleGraphTheoryNodeKindSet(
    nodeIndex: number,
    kind: 'goal' | 'start',
  ) {
    setGraphTheoryState((currentGraph) =>
      setGraphTheoryNodeKind(currentGraph, nodeIndex, kind),
    )
  }

  function handleGraphTheoryEdgeAdd(
    fromNodeIndex: number,
    toNodeIndex: number,
    cost: number,
  ) {
    setGraphTheoryState((currentGraph) =>
      addGraphTheoryEdge(currentGraph, fromNodeIndex, toNodeIndex, cost),
    )
  }

  function handleGraphTheoryNodePositionSet(
    nodeIndex: number,
    position: { x: number; y: number },
  ) {
    setGraphTheoryState((currentGraph) =>
      setGraphTheoryNodePosition(currentGraph, nodeIndex, position),
    )
  }

  function handleGraphTheoryEdgeDirectionCycle(edgeIndex: number) {
    setGraphTheoryState((currentGraph) =>
      cycleGraphTheoryEdgeDirection(currentGraph, edgeIndex),
    )
  }

  function handleApplyAllGraphTheoryEdgeCosts() {
    const nextCost = normalizeEdgeCost(graphEdgeCostInput, 1)
    setGraphTheoryState((currentGraph) => setAllGraphTheoryEdgeCosts(currentGraph, nextCost))
  }

  function handleApplyAllGraphTheoryNodeCosts() {
    const nextCost = normalizeEdgeCost(graphNodeCostInput, 1)
    setGraphTheoryState((currentGraph) => setAllGraphTheoryNodeCosts(currentGraph, nextCost))
  }

  function handleApplyGraphVertexCount() {
    const nextCount = normalizeGraphVertexCount(graphVertexCountInput, graphTheoryState.nodes.length)
    setGraphVertexCountInput(String(nextCount))
    setGraphTheoryState((currentGraph) => resizeGraphTheoryData(currentGraph, nextCount))
  }

  function handleGraphSearchStep() {
    setGraphSearchStates((currentStates) => {
      const nextStates = { ...currentStates }

      for (const algorithm of selectedGraphSearchAlgorithms) {
        nextStates[algorithm] = stepGraphTheorySearch(nextStates[algorithm])
      }

      return nextStates
    })
  }

  function handleGraphSearchComplete() {
    setGraphSearchStates((currentStates) => {
      const nextStates = { ...currentStates }

      for (const algorithm of selectedGraphSearchAlgorithms) {
        nextStates[algorithm] = completeGraphTheorySearch(nextStates[algorithm])
      }

      return nextStates
    })
  }

  function handleGraphSearchReset() {
    setGraphSearchStates(createGraphTheorySearchStateMap(graphTheoryState))
  }

  function handleGraphSearchAlgorithmToggle(nextAlgorithm: GraphTheorySearchAlgorithm) {
    setSelectedGraphSearchAlgorithms((currentAlgorithms) => {
      if (currentAlgorithms.includes(nextAlgorithm)) {
        if (currentAlgorithms.length === 1) {
          return currentAlgorithms
        }

        return currentAlgorithms.filter((algorithm) => algorithm !== nextAlgorithm)
      }

      return [...currentAlgorithms, nextAlgorithm]
    })
  }

  return {
    graphEdgeCostInput,
    graphEdgeCount: graphTheoryState.edges.length,
    graphNodeCostInput,
    graphNodeLabelInput,
    graphSearchStates,
    graphTheoryData: graphTheoryState,
    graphVertexCount: graphTheoryState.nodes.length,
    graphVertexCountInput,
    handleApplyAllGraphTheoryEdgeCosts,
    handleApplyAllGraphTheoryNodeCosts,
    handleApplyGraphVertexCount,
    handleGraphSearchAlgorithmToggle,
    handleGraphSearchComplete,
    handleGraphSearchReset,
    handleGraphSearchStep,
    handleGraphTheoryEdgeAdd,
    handleGraphTheoryEdgeCostSet,
    handleGraphTheoryEdgeDirectionCycle,
    handleGraphTheoryNodeCostSet,
    handleGraphTheoryNodeLabelSet,
    handleGraphTheoryNodeKindSet,
    handleGraphTheoryNodePositionSet,
    selectedGraphSearchAlgorithms,
    setGraphEdgeCostInput,
    setGraphNodeCostInput,
    setGraphNodeLabelInput,
    setGraphVertexCountInput,
    setGraphSearchStates,
    setSelectedGraphSearchAlgorithms,
  }
}

export { GRAPH_THEORY_SEARCH_ALGORITHM_OPTIONS }
export type { GraphTheorySearchAlgorithm, GraphTheorySearchState }
