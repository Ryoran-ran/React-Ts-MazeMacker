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
  findGraphTheoryNodeByKind,
  getGraphTheoryNeighbors,
} from '../data/graphTheorySearch.shared'
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
type GraphTheoryPlayState = {
  currentNodeId: number
  goalNodeId: number
  isSolved: boolean
  reachableEdgeIds: boolean[]
  reachableNodeIds: boolean[]
  startNodeId: number
  stepCount: number
  totalCost: number
  traversedEdgeIds: boolean[]
  traversedNodeIds: boolean[]
}

function createGraphTheorySearchStateMap(
  graph: GraphTheoryData,
): GraphTheorySearchStateMap {
  return {
    astar: createGraphTheorySearchState(graph, 'astar'),
    dfs: createGraphTheorySearchState(graph, 'dfs'),
    dijkstra: createGraphTheorySearchState(graph, 'dijkstra'),
  }
}

function createGraphTheoryPlayState(graph: GraphTheoryData): GraphTheoryPlayState {
  const startNodeId = findGraphTheoryNodeByKind(graph, 'start') ?? 0
  const goalNodeId =
    findGraphTheoryNodeByKind(graph, 'goal') ?? Math.max(0, graph.nodes.length - 1)
  const reachableNodeIds = graph.nodes.map(() => false)
  const reachableEdgeIds = graph.edges.map(() => false)
  const traversedNodeIds = graph.nodes.map(() => false)
  const traversedEdgeIds = graph.edges.map(() => false)

  traversedNodeIds[startNodeId] = true

  for (const neighbor of getGraphTheoryNeighbors(graph, startNodeId)) {
    reachableNodeIds[neighbor.nodeId] = true
    reachableEdgeIds[neighbor.edgeIndex] = true
  }

  return {
    currentNodeId: startNodeId,
    goalNodeId,
    isSolved: startNodeId === goalNodeId,
    reachableEdgeIds,
    reachableNodeIds,
    startNodeId,
    stepCount: 0,
    totalCost: 0,
    traversedEdgeIds,
    traversedNodeIds,
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

export function getOptimalGraphPlayCost(graph: GraphTheoryData) {
  const dijkstraState = completeGraphTheorySearch(createGraphTheorySearchState(graph, 'dijkstra'))
  const solvedCost = getSolvedGraphPathCost(dijkstraState)

  if (solvedCost === null) {
    return null
  }

  const startNodeId = findGraphTheoryNodeByKind(graph, 'start') ?? 0
  const startNodeCost = graph.nodes[startNodeId]?.cost ?? 0

  return solvedCost - startNodeCost
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
  const [graphPlayState, setGraphPlayState] = useState<GraphTheoryPlayState>(() =>
    createGraphTheoryPlayState(createDefaultGraphTheoryData(7)),
  )

  useEffect(() => {
    setGraphSearchStates(createGraphTheorySearchStateMap(graphTheoryState))
    setGraphPlayState(createGraphTheoryPlayState(graphTheoryState))
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

  function handleGraphPlayReset() {
    setGraphPlayState(createGraphTheoryPlayState(graphTheoryState))
  }

  function handleGraphPlayMove(nextNodeId: number) {
    setGraphPlayState((currentState) => {
      if (currentState.isSolved || nextNodeId === currentState.currentNodeId) {
        return currentState
      }

      const neighbor = getGraphTheoryNeighbors(
        graphTheoryState,
        currentState.currentNodeId,
      ).find(
        (candidate: { edgeCost: number; edgeIndex: number; nodeCost: number; nodeId: number }) =>
          candidate.nodeId === nextNodeId,
      )

      if (!neighbor) {
        return currentState
      }

      const traversedNodeIds = [...currentState.traversedNodeIds]
      const traversedEdgeIds = [...currentState.traversedEdgeIds]
      const reachableNodeIds = graphTheoryState.nodes.map(() => false)
      const reachableEdgeIds = graphTheoryState.edges.map(() => false)
      const totalCost = currentState.totalCost + neighbor.edgeCost + neighbor.nodeCost

      traversedNodeIds[nextNodeId] = true
      traversedEdgeIds[neighbor.edgeIndex] = true

      for (const nextNeighbor of getGraphTheoryNeighbors(graphTheoryState, nextNodeId)) {
        reachableNodeIds[nextNeighbor.nodeId] = true
        reachableEdgeIds[nextNeighbor.edgeIndex] = true
      }

      return {
        ...currentState,
        currentNodeId: nextNodeId,
        isSolved: nextNodeId === currentState.goalNodeId,
        reachableEdgeIds,
        reachableNodeIds,
        stepCount: currentState.stepCount + 1,
        totalCost,
        traversedEdgeIds,
        traversedNodeIds,
      }
    })
  }

  return {
    graphEdgeCostInput,
    graphEdgeCount: graphTheoryState.edges.length,
    graphNodeCostInput,
    graphNodeLabelInput,
    graphPlayState,
    graphSearchStates,
    graphTheoryData: graphTheoryState,
    graphVertexCount: graphTheoryState.nodes.length,
    graphVertexCountInput,
    handleApplyAllGraphTheoryEdgeCosts,
    handleApplyAllGraphTheoryNodeCosts,
    handleApplyGraphVertexCount,
    handleGraphPlayMove,
    handleGraphPlayReset,
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
export type { GraphTheoryPlayState, GraphTheorySearchAlgorithm, GraphTheorySearchState }
