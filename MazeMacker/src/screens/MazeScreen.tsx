import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import GraphTheoryCanvas from '../components/GraphTheoryCanvas'
import MazeCanvas, {
  type MazeDisplayMode,
  type MazeEditMode,
  type MazeData,
  type MazeWallDirection,
} from '../components/MazeCanvas'
import {
  DEFAULT_MAZE_DIMENSIONS,
  DEFAULT_MAZE_SEED,
  MAZE_ALGORITHM_OPTIONS,
  normalizeMazeSeed,
  type MazeAlgorithm,
  type MazeCellKind,
  type MazeDimensions,
  completeMazeGeneration,
  createMazeGenerationState,
  setMazeCellKind,
  setAllMazeEdgeCosts,
  setMazeEdgeCost,
  toggleMazeWall,
} from '../data/mazeGenerator'
import {
  buildMazeTransferPayload,
  downloadMazeTransferPayload,
} from '../data/mazeTransfer.export'
import { parseMazeTransferPayload } from '../data/mazeTransfer.import'
import {
  getSolvedMazePathCost,
  MAZE_SEARCH_ALGORITHM_OPTIONS,
  useMazeMode,
  type MazeSearchAlgorithm,
} from './useMazeMode'
import {
  calculateHeuristic,
  getCellNeighbor,
  getMovementCost,
} from '../data/mazeSearch.shared'
import {
  GRAPH_THEORY_SEARCH_ALGORITHM_OPTIONS,
  getOptimalGraphPlayCost,
  getSolvedGraphPathCost,
  useGraphTheoryMode,
} from './useGraphTheoryMode'
import {
  completeGraphTheorySearch,
  createGraphTheorySearchState,
} from '../data/graphTheorySearch'
import mazeScreenText from '../text/mazeScreen.json'

const DEFAULT_GENERATION_INTERVAL_MS = 40
const DEFAULT_SEARCH_INTERVAL_MS = 40
const DEFAULT_CLICK_MOVE_INTERVAL_MS = 90
const MAX_PLAYBACK_INTERVAL_MS = 180
const MIN_PLAYBACK_INTERVAL_MS = 20
const MIN_DIMENSION = 2
const MIN_GRAPH_VERTEX_COUNT = 2
const MAX_GRAPH_VERTEX_COUNT = 24
const MIN_EDGE_COST = 0
const MAX_EDGE_COST = 99
type AppMode = 'maze' | 'graphTheory'
type EditMode = MazeEditMode | 'direction' | 'move' | 'name'
type SidebarTab = 'controls' | 'display' | 'edit' | 'play' | 'search'
type PlayHandGuideMode = 'hidden' | 'left' | 'right'
type PlayWallVisibilityMode = 'all' | 'hidden' | 'nearby'
type PlayClickMoveMode = 'disabled' | 'enabled'
type PlayWallDiscoveryMode = 'bumpOnly' | 'hidden' | 'visited'
type GraphNodeTextOrder = 'costFirst' | 'labelFirst'
type RevealedWall = {
  direction: MazeWallDirection
  x: number
  y: number
}
type PlayerState = {
  facingDirection: MazeWallDirection
  isSolved: boolean
  position: { x: number; y: number }
  revealedWalls: RevealedWall[]
  stepCount: number
  visited: boolean[][]
}
type PlayerBumpState = {
  direction: MazeWallDirection
  tick: number
}
type PlayerTravelPath = Array<{ x: number; y: number }>
type ToastState = {
  message: string
  tone: 'error' | 'success'
}

function normalizeDimension(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) {
    return fallback
  }

  return Math.max(MIN_DIMENSION, parsed)
}

function normalizeEdgeCost(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) {
    return fallback
  }

  return Math.min(MAX_EDGE_COST, Math.max(MIN_EDGE_COST, parsed))
}

function getPlaybackLabel(intervalMs: number) {
  return `${Math.round(1000 / intervalMs)} fps`
}

function createRandomSeed() {
  return Math.floor(Date.now() % 2147483647)
}

function createBooleanGrid(maze: MazeData) {
  return maze.map((row) => row.map(() => false))
}

function findCellByKind(maze: MazeData, kind: 'goal' | 'start') {
  for (let y = 0; y < maze.length; y += 1) {
    for (let x = 0; x < maze[y].length; x += 1) {
      if (maze[y][x].kind === kind) {
        return { x, y }
      }
    }
  }

  return null
}

function createPlayerState(maze: MazeData): PlayerState {
  const position = findCellByKind(maze, 'start') ?? { x: 0, y: 0 }
  const visited = createBooleanGrid(maze)
  visited[position.y][position.x] = true

  return {
    facingDirection: 'right',
    isSolved: maze[position.y][position.x].kind === 'goal',
    position,
    revealedWalls: [],
    stepCount: 0,
    visited,
  }
}

function getNextPosition(
  maze: MazeData,
  position: { x: number; y: number },
  direction: MazeWallDirection,
) {
  if (maze[position.y][position.x].walls[direction]) {
    return null
  }

  if (direction === 'top') {
    return position.y > 0 ? { x: position.x, y: position.y - 1 } : null
  }
  if (direction === 'right') {
    return position.x < maze[0].length - 1 ? { x: position.x + 1, y: position.y } : null
  }
  if (direction === 'bottom') {
    return position.y < maze.length - 1 ? { x: position.x, y: position.y + 1 } : null
  }

  return position.x > 0 ? { x: position.x - 1, y: position.y } : null
}

function getOppositeDirection(direction: MazeWallDirection): MazeWallDirection {
  if (direction === 'top') {
    return 'bottom'
  }
  if (direction === 'right') {
    return 'left'
  }
  if (direction === 'bottom') {
    return 'top'
  }

  return 'right'
}

function getAdjacentPosition(
  maze: MazeData,
  position: { x: number; y: number },
  direction: MazeWallDirection,
) {
  if (direction === 'top') {
    return position.y > 0 ? { x: position.x, y: position.y - 1 } : null
  }
  if (direction === 'right') {
    return position.x < maze[0].length - 1 ? { x: position.x + 1, y: position.y } : null
  }
  if (direction === 'bottom') {
    return position.y < maze.length - 1 ? { x: position.x, y: position.y + 1 } : null
  }

  return position.x > 0 ? { x: position.x - 1, y: position.y } : null
}

function getDirectionTowardTarget(
  from: { x: number; y: number },
  to: { x: number; y: number },
): MazeWallDirection {
  const dx = to.x - from.x
  const dy = to.y - from.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left'
  }

  return dy >= 0 ? 'bottom' : 'top'
}

function findMazeAStarPath(
  maze: MazeData,
  start: { x: number; y: number },
  goal: { x: number; y: number },
) {
  if (start.x === goal.x && start.y === goal.y) {
    return [start]
  }

  const rowCount = maze.length
  const columnCount = maze[0]?.length ?? 0
  const costs = maze.map((row) => row.map(() => Number.POSITIVE_INFINITY))
  const parents = maze.map((row) => row.map(() => null as { x: number; y: number } | null))
  const frontier: Array<{ cost: number; position: { x: number; y: number } }> = [
    { cost: 0, position: start },
  ]

  costs[start.y][start.x] = 0

  while (frontier.length > 0) {
    let bestIndex = 0
    let bestHeuristic = calculateHeuristic(frontier[0].position, goal)
    let bestScore = frontier[0].cost + bestHeuristic

    for (let index = 1; index < frontier.length; index += 1) {
      const heuristic = calculateHeuristic(frontier[index].position, goal)
      const score = frontier[index].cost + heuristic

      if (score < bestScore || (score === bestScore && heuristic < bestHeuristic)) {
        bestIndex = index
        bestHeuristic = heuristic
        bestScore = score
      }
    }

    const [current] = frontier.splice(bestIndex, 1)
    const { position } = current

    if (current.cost > costs[position.y][position.x]) {
      continue
    }

    if (position.x === goal.x && position.y === goal.y) {
      const path: Array<{ x: number; y: number }> = []
      let cursor: { x: number; y: number } | null = goal

      while (cursor) {
        path.push(cursor)

        if (cursor.x === start.x && cursor.y === start.y) {
          break
        }

        cursor = parents[cursor.y][cursor.x]
      }

      return path.reverse()
    }

    for (const direction of ['top', 'right', 'bottom', 'left'] as MazeWallDirection[]) {
      if (maze[position.y][position.x].walls[direction]) {
        continue
      }

      const next = getCellNeighbor(maze, position, direction)

      if (!next || next.x < 0 || next.x >= columnCount || next.y < 0 || next.y >= rowCount) {
        continue
      }

      const nextCost = current.cost + getMovementCost(maze, position, direction)

      if (nextCost >= costs[next.y][next.x]) {
        continue
      }

      costs[next.y][next.x] = nextCost
      parents[next.y][next.x] = position
      frontier.push({ cost: nextCost, position: next })
    }
  }

  return null
}

function getDirectionBetweenCells(
  from: { x: number; y: number },
  to: { x: number; y: number },
): MazeWallDirection | null {
  if (to.x === from.x && to.y === from.y - 1) {
    return 'top'
  }
  if (to.x === from.x + 1 && to.y === from.y) {
    return 'right'
  }
  if (to.x === from.x && to.y === from.y + 1) {
    return 'bottom'
  }
  if (to.x === from.x - 1 && to.y === from.y) {
    return 'left'
  }

  return null
}

function buildPathGridFromPositions(
  maze: MazeData,
  positions: Array<{ x: number; y: number }> | null,
) {
  if (!positions || positions.length === 0) {
    return undefined
  }

  const path = maze.map((row) => row.map(() => false))

  for (const position of positions) {
    path[position.y][position.x] = true
  }

  return path
}


function MazeScreen() {
  const importFileInputRef = useRef<HTMLInputElement | null>(null)
  const mazeMode = useMazeMode(DEFAULT_MAZE_DIMENSIONS, 'digging')
  const graphTheoryMode = useGraphTheoryMode()
  const [appMode, setAppMode] = useState<AppMode>('maze')
  const [playerState, setPlayerState] = useState<PlayerState>(() =>
    createPlayerState(
      createMazeGenerationState(DEFAULT_MAZE_DIMENSIONS, 'digging', null).maze,
    ),
  )
  const [playerBumpState, setPlayerBumpState] = useState<PlayerBumpState | null>(null)
  const [playerTravelPath, setPlayerTravelPath] = useState<PlayerTravelPath>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSearchPlaying, setIsSearchPlaying] = useState(false)
  const [generationIntervalMs, setGenerationIntervalMs] = useState(DEFAULT_GENERATION_INTERVAL_MS)
  const [searchIntervalMs, setSearchIntervalMs] = useState(DEFAULT_SEARCH_INTERVAL_MS)
  const [activeTab, setActiveTab] = useState<SidebarTab>('controls')
  const [editMode, setEditMode] = useState<EditMode>('wall')
  const [displayMode, setDisplayMode] = useState<MazeDisplayMode>('maze')
  const [showGraphEdgeCosts, setShowGraphEdgeCosts] = useState(false)
  const [showEditGoalPath, setShowEditGoalPath] = useState(false)
  const [showGraphTheoryEditGoalPath, setShowGraphTheoryEditGoalPath] = useState(false)
  const [playHandGuideMode, setPlayHandGuideMode] = useState<PlayHandGuideMode>('hidden')
  const [playWallDiscoveryMode, setPlayWallDiscoveryMode] =
    useState<PlayWallDiscoveryMode>('visited')
  const [playWallVisibilityMode, setPlayWallVisibilityMode] =
    useState<PlayWallVisibilityMode>('all')
  const [playClickMoveMode, setPlayClickMoveMode] = useState<PlayClickMoveMode>('disabled')
  const [isGraphNodeLabelVisible, setIsGraphNodeLabelVisible] = useState(true)
  const [graphNodeTextOrder, setGraphNodeTextOrder] = useState<GraphNodeTextOrder>('labelFirst')
  const [mazeTransferText, setMazeTransferText] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [editCostInput, setEditCostInput] = useState('1')
  const [dimensionInputs, setDimensionInputs] = useState({
    columns: String(DEFAULT_MAZE_DIMENSIONS.columns),
    rows: String(DEFAULT_MAZE_DIMENSIONS.rows),
  })
  const [seedInput, setSeedInput] = useState(String(DEFAULT_MAZE_SEED))
  const [useSeed, setUseSeed] = useState(false)
  const {
    generationState,
    handleGenerationComplete,
    handleGenerationStep,
    handleSearchAlgorithmToggle: handleMazeSearchAlgorithmToggle,
    handleSearchComplete: handleMazeSearchComplete,
    handleSearchReset: handleMazeSearchReset,
    handleSearchStep: handleMazeSearchStep,
    searchStates,
    selectedAlgorithm,
    selectedSearchAlgorithms,
    setGenerationState,
    setSelectedAlgorithm,
  } = mazeMode
  const {
    graphEdgeCostInput,
    graphEdgeCount,
    graphNodeCostInput,
    graphNodeLabelInput,
    graphPlayState,
    graphSearchStates,
    graphTheoryData,
    graphVertexCount,
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
  } = graphTheoryMode
  const optimalGraphPlayCost = getOptimalGraphPlayCost(graphTheoryData)
  const effectiveDisplayMode: MazeDisplayMode =
    appMode === 'graphTheory' ? 'graph' : displayMode
  const effectiveShowGraphEdgeCosts =
    appMode === 'graphTheory' || (activeTab === 'edit' && editMode === 'cost')
      ? true
      : showGraphEdgeCosts
  const editPreviewPath = useMemo(() => {
    if (appMode !== 'maze' || activeTab !== 'edit' || !showEditGoalPath) {
      return undefined
    }

    const start = findCellByKind(generationState.maze, 'start')
    const goal = findCellByKind(generationState.maze, 'goal')

    if (!start || !goal) {
      return undefined
    }

    return buildPathGridFromPositions(
      generationState.maze,
      findMazeAStarPath(generationState.maze, start, goal),
    )
  }, [activeTab, appMode, generationState.maze, showEditGoalPath])
  const graphTheoryEditPreviewPath = useMemo(() => {
    if (appMode !== 'graphTheory' || activeTab !== 'edit' || !showGraphTheoryEditGoalPath) {
      return null
    }

    const searchState = completeGraphTheorySearch(createGraphTheorySearchState(graphTheoryData, 'astar'))

    return {
      edgeIds: searchState.pathEdgeIds,
      nodeIds: searchState.pathNodeIds,
    }
  }, [activeTab, appMode, graphTheoryData, showGraphTheoryEditGoalPath])

  useEffect(() => {
    if (!isPlaying || generationState.isComplete) {
      return
    }

    const timerId = window.setInterval(() => {
      handleGenerationStep()
    }, generationIntervalMs)

    return () => {
      window.clearInterval(timerId)
    }
  }, [generationIntervalMs, generationState.isComplete, isPlaying])

  useEffect(() => {
    if (
      !isSearchPlaying ||
      (appMode === 'graphTheory'
        ? selectedGraphSearchAlgorithms.every(
            (algorithm) => graphSearchStates[algorithm].isComplete,
          )
        : selectedSearchAlgorithms.every((algorithm) => searchStates[algorithm].isComplete))
    ) {
      return
    }

    const timerId = window.setInterval(() => {
      if (appMode === 'graphTheory') {
        handleGraphSearchStep()
        return
      }

      handleMazeSearchStep()
    }, searchIntervalMs)

    return () => {
      window.clearInterval(timerId)
    }
  }, [
    appMode,
    graphSearchStates,
    isSearchPlaying,
    searchIntervalMs,
    searchStates,
    selectedGraphSearchAlgorithms,
    selectedSearchAlgorithms,
  ])

  useEffect(() => {
    if (generationState.isComplete) {
      setIsPlaying(false)
    }
  }, [generationState.isComplete])

  useEffect(() => {
    if (
      (appMode === 'graphTheory'
        ? selectedGraphSearchAlgorithms.every(
            (algorithm) => graphSearchStates[algorithm].isComplete,
          )
        : selectedSearchAlgorithms.every((algorithm) => searchStates[algorithm].isComplete))
    ) {
      setIsSearchPlaying(false)
    }
  }, [
    appMode,
    graphSearchStates,
    searchStates,
    selectedGraphSearchAlgorithms,
    selectedSearchAlgorithms,
  ])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null)
    }, 4000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toast])

  useEffect(() => {
    setIsSearchPlaying(false)
    setPlayerState(createPlayerState(generationState.maze))
    setPlayerBumpState(null)
    setPlayerTravelPath([])
  }, [generationState.maze])

  useEffect(() => {
    if (activeTab !== 'play' || playerTravelPath.length === 0 || playerState.isSolved) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const nextPosition = playerTravelPath[0]
      const direction = getDirectionBetweenCells(playerState.position, nextPosition)

      if (!direction) {
        setPlayerTravelPath((currentPath) => currentPath.slice(1))
        return
      }

      handlePlayerMove(direction, true)
      setPlayerTravelPath((currentPath) => currentPath.slice(1))
    }, DEFAULT_CLICK_MOVE_INTERVAL_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeTab, playerState.isSolved, playerState.position, playerTravelPath])

  useEffect(() => {
    setIsSearchPlaying(false)
  }, [graphTheoryData])

  useEffect(() => {
    if (activeTab !== 'play') {
      return
    }

    const keyToDirection: Record<string, MazeWallDirection> = {
      ArrowDown: 'bottom',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'top',
      a: 'left',
      d: 'right',
      s: 'bottom',
      w: 'top',
    }

    function handleKeyDown(event: KeyboardEvent) {
      const direction = keyToDirection[event.key]

      if (!direction) {
        return
      }

      event.preventDefault()
      handlePlayerMove(direction)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeTab, generationState.maze, playerState])

  function handleStep() {
    handleGenerationStep()
  }

  function handlePlayToggle() {
    setIsPlaying((currentState) => !currentState)
  }

  function handleSearchStep() {
    if (appMode === 'graphTheory') {
      handleGraphSearchStep()
      return
    }

    handleMazeSearchStep()
  }

  function handleSearchPlayToggle() {
    setIsSearchPlaying((currentState) => !currentState)
  }

  function handleTabChange(nextTab: SidebarTab) {
    if (nextTab === 'edit' || nextTab === 'play' || nextTab === 'search') {
      setIsPlaying(false)
    }

    if (nextTab !== 'search') {
      setIsSearchPlaying(false)
    }

    if (nextTab === 'edit') {
      setEditMode(appMode === 'graphTheory' ? 'cost' : 'wall')
    }

    setActiveTab(nextTab)
  }

  function handleAppModeChange(nextMode: AppMode) {
    setIsPlaying(false)
    setIsSearchPlaying(false)
    if (nextMode === 'graphTheory' && activeTab === 'controls') {
      setActiveTab('display')
    }
    if (activeTab === 'edit') {
      setEditMode(nextMode === 'graphTheory' ? 'cost' : 'wall')
    }
    setAppMode(nextMode)
  }

  function handleComplete() {
    setIsPlaying(false)
    handleGenerationComplete()
  }

  function handleSearchComplete() {
    setIsSearchPlaying(false)

    if (appMode === 'graphTheory') {
      handleGraphSearchComplete()
      return
    }

    handleMazeSearchComplete()
  }

  function buildDimensionsFromInputs(): MazeDimensions {
    return {
      columns: normalizeDimension(
        dimensionInputs.columns,
        generationState.dimensions.columns,
      ),
      rows: normalizeDimension(dimensionInputs.rows, generationState.dimensions.rows),
    }
  }

  function buildSeedFromInput() {
    const parsed = Number.parseInt(seedInput, 10)

    if (Number.isNaN(parsed)) {
      return generationState.seed
    }

    return normalizeMazeSeed(parsed)
  }

  function resolveGenerationSeed() {
    return useSeed ? buildSeedFromInput() : null
  }

  function handleApplyDimensions() {
    const nextDimensions = buildDimensionsFromInputs()
    const nextSeed = resolveGenerationSeed()

    setIsPlaying(false)
    setDimensionInputs({
      columns: String(nextDimensions.columns),
      rows: String(nextDimensions.rows),
    })
    setSeedInput(String(nextSeed))
    setGenerationState(createMazeGenerationState(nextDimensions, selectedAlgorithm, nextSeed))
  }

  function handleReset() {
    const nextDimensions = buildDimensionsFromInputs()
    const nextSeed = resolveGenerationSeed()

    setIsPlaying(false)
    setDimensionInputs({
      columns: String(nextDimensions.columns),
      rows: String(nextDimensions.rows),
    })
    setSeedInput(String(nextSeed))
    setGenerationState(createMazeGenerationState(nextDimensions, selectedAlgorithm, nextSeed))
  }

  function handleSearchReset() {
    setIsSearchPlaying(false)

    if (appMode === 'graphTheory') {
      handleGraphSearchReset()
      return
    }

    handleMazeSearchReset()
  }

  function handlePlayReset() {
    setPlayerState(createPlayerState(generationState.maze))
    setPlayerBumpState(null)
    setPlayerTravelPath([])
  }

  function handlePlayGenerate() {
    const nextDimensions = buildDimensionsFromInputs()
    const nextSeed = resolveGenerationSeed()
    const nextState = completeMazeGeneration(
      createMazeGenerationState(nextDimensions, selectedAlgorithm, nextSeed),
    )

    setIsPlaying(false)
    setPlayerTravelPath([])
    setDimensionInputs({
      columns: String(nextDimensions.columns),
      rows: String(nextDimensions.rows),
    })
    setSeedInput(String(nextSeed))
    setGenerationState(nextState)
  }

  function handleAlgorithmChange(nextAlgorithm: MazeAlgorithm) {
    const nextDimensions = buildDimensionsFromInputs()
    const nextSeed = resolveGenerationSeed()

    setIsPlaying(false)
    setSelectedAlgorithm(nextAlgorithm)
    setSeedInput(String(nextSeed))
    setGenerationState(createMazeGenerationState(nextDimensions, nextAlgorithm, nextSeed))
  }

  function handleSearchAlgorithmToggle(nextAlgorithm: MazeSearchAlgorithm) {
    setIsSearchPlaying(false)
    handleMazeSearchAlgorithmToggle(nextAlgorithm)
  }

  const areSelectedSearchesComplete =
    appMode === 'graphTheory'
      ? selectedGraphSearchAlgorithms.every(
          (algorithm) => graphSearchStates[algorithm].isComplete,
        )
      : selectedSearchAlgorithms.every((algorithm) => searchStates[algorithm].isComplete)

  function handlePlayerMove(
    direction: MazeWallDirection,
    preserveTravelPath = false,
  ) {
    if (!preserveTravelPath) {
      setPlayerTravelPath([])
    }
    setPlayerState((currentState) => {
      if (currentState.isSolved) {
        return currentState
      }

      const nextPosition = getNextPosition(generationState.maze, currentState.position, direction)

      if (!nextPosition) {
        setPlayerBumpState((currentState) => ({
          direction,
          tick: (currentState?.tick ?? 0) + 1,
        }))

        if (playWallDiscoveryMode === 'hidden') {
          return currentState
        }

        const revealedKeys = new Set(
          currentState.revealedWalls.map((wall) => `${wall.x}:${wall.y}:${wall.direction}`),
        )
        const nextRevealedWalls = [...currentState.revealedWalls]
        const primaryWall = {
          direction,
          x: currentState.position.x,
          y: currentState.position.y,
        }
        const primaryKey = `${primaryWall.x}:${primaryWall.y}:${primaryWall.direction}`

        if (!revealedKeys.has(primaryKey)) {
          revealedKeys.add(primaryKey)
          nextRevealedWalls.push(primaryWall)
        }

        const adjacentPosition = getAdjacentPosition(
          generationState.maze,
          currentState.position,
          direction,
        )

        if (adjacentPosition) {
          const oppositeWall = {
            direction: getOppositeDirection(direction),
            x: adjacentPosition.x,
            y: adjacentPosition.y,
          }
          const oppositeKey = `${oppositeWall.x}:${oppositeWall.y}:${oppositeWall.direction}`

          if (!revealedKeys.has(oppositeKey)) {
            revealedKeys.add(oppositeKey)
            nextRevealedWalls.push(oppositeWall)
          }
        }

        if (nextRevealedWalls.length === currentState.revealedWalls.length) {
          return currentState
        }

        return {
          ...currentState,
          revealedWalls: nextRevealedWalls,
        }
      }

      const visited = currentState.visited.map((row) => [...row])
      visited[nextPosition.y][nextPosition.x] = true

      return {
        facingDirection: direction,
        isSolved: generationState.maze[nextPosition.y][nextPosition.x].kind === 'goal',
        position: nextPosition,
        revealedWalls: currentState.revealedWalls,
        stepCount: currentState.stepCount + 1,
        visited,
      }
    })
  }

  function handlePlayerCellActivate(target: { x: number; y: number }) {
    if (playClickMoveMode !== 'enabled') {
      return
    }

    const path = findMazeAStarPath(generationState.maze, playerState.position, target)

    if (!path || path.length <= 1) {
      setPlayerBumpState({
        direction: getDirectionTowardTarget(playerState.position, target),
        tick: Date.now(),
      })
      return
    }

    setPlayerTravelPath(path.slice(1))
  }

  function handleWallToggle(
    position: { x: number; y: number },
    direction: MazeWallDirection,
  ) {
    setIsPlaying(false)
    setGenerationState((currentState) => toggleMazeWall(currentState, position, direction))
  }

  function handleCellSelect(position: { x: number; y: number }) {
    if (editMode === 'wall' || editMode === 'cost' || editMode === 'move') {
      return
    }

    const nextKind: MazeCellKind = editMode === 'start' ? 'start' : 'goal'
    setIsPlaying(false)
    setGenerationState((currentState) => setMazeCellKind(currentState, position, nextKind))
  }

  function handleEdgeCostSet(
    position: { x: number; y: number },
    direction: MazeWallDirection,
    nextCost: number,
  ) {
    setIsPlaying(false)
    setGenerationState((currentState) =>
      setMazeEdgeCost(currentState, position, direction, nextCost),
    )
  }

  function handleApplyAllEdgeCosts() {
    const nextCost = normalizeEdgeCost(editCostInput, 1)

    setIsPlaying(false)
    setGenerationState((currentState) => setAllMazeEdgeCosts(currentState, nextCost))
  }

  function handleExportMaze() {
    const payload = buildMazeTransferPayload(
      generationState.maze,
      generationState.dimensions,
      selectedAlgorithm,
      generationState.seed,
    )
    const json = downloadMazeTransferPayload(
      payload,
      generationState.dimensions,
      selectedAlgorithm,
    )

    setMazeTransferText(json)
    setToast({
      message: mazeScreenText.importExport.exported,
      tone: 'success',
    })
  }

  function applyImportedMaze(mazeTransferJson: string) {
    try {
      const importedPayload = parseMazeTransferPayload(mazeTransferJson, {
        dimensionMismatch: mazeScreenText.importExport.errors.dimensionMismatch,
        invalidJson: mazeScreenText.importExport.errors.invalidJson,
        invalidMarkers: mazeScreenText.importExport.errors.invalidMarkers,
        invalidMaze: mazeScreenText.importExport.errors.invalidMaze,
      })
      const nextAlgorithm = importedPayload.algorithm ?? selectedAlgorithm
      const nextDimensions = importedPayload.dimensions ?? {
        columns: importedPayload.maze[0].length,
        rows: importedPayload.maze.length,
      }
      const nextSeed = importedPayload.seed ?? (useSeed ? buildSeedFromInput() : null)

      setIsPlaying(false)
      setIsSearchPlaying(false)
      setSelectedAlgorithm(nextAlgorithm)
      setMazeTransferText(mazeTransferJson)
      setSeedInput(String(nextSeed))
      setDimensionInputs({
        columns: String(nextDimensions.columns),
        rows: String(nextDimensions.rows),
      })
      setGenerationState({
        ...createMazeGenerationState(nextDimensions, nextAlgorithm, nextSeed),
        currentCell: null,
        isComplete: true,
        maze: importedPayload.maze,
        stepCount: 0,
      })
      setToast({
        message: mazeScreenText.importExport.imported,
        tone: 'success',
      })
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : mazeScreenText.importExport.errors.invalidJson,
        tone: 'error',
      })
    }
  }

  function handleImportFromTextArea() {
    applyImportedMaze(mazeTransferText)
  }

  function handleImportFromFile() {
    importFileInputRef.current?.click()
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const mazeTransferJson = await file.text()
      applyImportedMaze(mazeTransferJson)
    } finally {
      event.target.value = ''
    }
  }

  function handleRandomizeSeed() {
    setSeedInput(String(createRandomSeed()))
  }

  function renderTopActions() {
    if (appMode === 'graphTheory' && activeTab === 'search') {
      return (
        <>
          <button
            className="app__button"
            onClick={handleSearchStep}
            disabled={areSelectedSearchesComplete || isSearchPlaying}
          >
            {mazeScreenText.buttons.step}
          </button>
          <button
            className="app__button"
            onClick={handleSearchPlayToggle}
            disabled={areSelectedSearchesComplete}
          >
            {isSearchPlaying ? mazeScreenText.buttons.stop : mazeScreenText.buttons.play}
          </button>
          <button
            className="app__button"
            onClick={handleSearchComplete}
            disabled={areSelectedSearchesComplete}
          >
            {mazeScreenText.buttons.complete}
          </button>
          <button className="app__button app__button--secondary" onClick={handleSearchReset}>
            {mazeScreenText.buttons.reset}
          </button>
        </>
      )
    }

    if (appMode === 'graphTheory' && activeTab === 'play') {
      return (
        <button className="app__button app__button--secondary" onClick={handleGraphPlayReset}>
          {mazeScreenText.buttons.reset}
        </button>
      )
    }

    if (appMode === 'graphTheory') {
      return null
    }

    if (activeTab === 'edit') {
      return (
        <>
          <button className="app__button" onClick={handleExportMaze}>
            {mazeScreenText.importExport.export}
          </button>
          <button className="app__button" onClick={handleImportFromFile}>
            {mazeScreenText.importExport.import}
          </button>
          <button className="app__button app__button--secondary" onClick={handleApplyDimensions}>
            {mazeScreenText.buttons.applySize}
          </button>
          <button
            className="app__button"
            onClick={handleComplete}
            disabled={generationState.isComplete}
          >
            {mazeScreenText.buttons.complete}
          </button>
          <button className="app__button app__button--secondary" onClick={handleReset}>
            {mazeScreenText.buttons.reset}
          </button>
        </>
      )
    }

    if (activeTab === 'search') {
      return (
        <>
          <button
            className="app__button"
            onClick={handleSearchStep}
            disabled={areSelectedSearchesComplete || isSearchPlaying}
          >
            {mazeScreenText.buttons.step}
          </button>
          <button
            className="app__button"
            onClick={handleSearchPlayToggle}
            disabled={areSelectedSearchesComplete}
          >
            {isSearchPlaying ? mazeScreenText.buttons.stop : mazeScreenText.buttons.play}
          </button>
          <button
            className="app__button"
            onClick={handleSearchComplete}
            disabled={areSelectedSearchesComplete}
          >
            {mazeScreenText.buttons.complete}
          </button>
          <button className="app__button app__button--secondary" onClick={handleSearchReset}>
            {mazeScreenText.buttons.reset}
          </button>
        </>
      )
    }

    if (activeTab === 'play') {
      return (
        <>
          <button className="app__button" onClick={handlePlayGenerate}>
            {mazeScreenText.play.generate}
          </button>
          <button className="app__button app__button--secondary" onClick={handlePlayReset}>
            {mazeScreenText.buttons.reset}
          </button>
        </>
      )
    }

    return (
      <>
        <button className="app__button app__button--secondary" onClick={handleApplyDimensions}>
          {mazeScreenText.buttons.applySize}
        </button>
        <button
          className="app__button"
          onClick={handleStep}
          disabled={generationState.isComplete || isPlaying}
        >
          {mazeScreenText.buttons.step}
        </button>
        <button
          className="app__button"
          onClick={handlePlayToggle}
          disabled={generationState.isComplete}
        >
          {isPlaying ? mazeScreenText.buttons.stop : mazeScreenText.buttons.play}
        </button>
        <button
          className="app__button"
          onClick={handleComplete}
          disabled={generationState.isComplete}
        >
          {mazeScreenText.buttons.complete}
        </button>
        <button className="app__button app__button--secondary" onClick={handleReset}>
          {mazeScreenText.buttons.reset}
        </button>
      </>
    )
  }

  return (
    <main className="app">
      <header className="app__topbar">
        <h1>{mazeScreenText.title}</h1>
        <div className="app__topbarSide">
          <div className="app__statusArea">
            <div className="app__statusRow" aria-label="Maze status">
              {appMode === 'graphTheory' ? (
                <>
                  <span className="app__statusItem">
                    {mazeScreenText.graphTheory.vertices}: {graphVertexCount}
                  </span>
                  <span className="app__statusItem">
                    {mazeScreenText.graphTheory.edges}: {graphEdgeCount}
                  </span>
                </>
              ) : (
                <>
                  <span className="app__statusItem">
                    {mazeScreenText.status.algorithm}:{' '}
                    {mazeScreenText.algorithm.options[selectedAlgorithm]}
                  </span>
                  <span className="app__statusItem">
                    {mazeScreenText.status.dimensions}: {generationState.dimensions.columns} x{' '}
                    {generationState.dimensions.rows}
                  </span>
                  <span className="app__statusItem">
                    {mazeScreenText.status.steps}: {generationState.stepCount}
                    {isPlaying ? ` / ${mazeScreenText.status.playing}` : ''}
                    {generationState.isComplete ? ` / ${mazeScreenText.status.completed}` : ''}
                  </span>
                </>
              )}
            </div>
            <label className="app__modeField" aria-label={mazeScreenText.mode.label}>
              <select
                className="app__input app__modeSelect"
                value={appMode}
                onChange={(event) => handleAppModeChange(event.target.value as AppMode)}
              >
                <option value="maze">{mazeScreenText.mode.maze}</option>
                <option value="graphTheory">{mazeScreenText.mode.graphTheory}</option>
              </select>
            </label>
          </div>
          <div className="app__topbarActions">{renderTopActions()}</div>
        </div>
      </header>

      <section className="app__panel">
        {appMode === 'graphTheory' && activeTab === 'edit' ? (
          <div className="app__graphTheoryPanel">
            <header className="app__graphTheoryPanelHeader">
              <h2>{mazeScreenText.graphTheory.editTitle}</h2>
              <p>{mazeScreenText.graphTheory.editHint}</p>
            </header>
            <GraphTheoryCanvas
              activeEdgeIds={graphTheoryEditPreviewPath?.edgeIds}
              activeNodeIds={graphTheoryEditPreviewPath?.nodeIds}
              graph={graphTheoryData}
              editable
              editEdgeCostValue={normalizeEdgeCost(graphEdgeCostInput, 1)}
              isNodeLabelVisible={isGraphNodeLabelVisible}
              nodeTextOrder={graphNodeTextOrder}
              editNodeLabelValue={graphNodeLabelInput}
              editNodeCostValue={normalizeEdgeCost(graphNodeCostInput, 1)}
              editMode={editMode}
              onEdgeAdd={handleGraphTheoryEdgeAdd}
              onEdgeCostSet={handleGraphTheoryEdgeCostSet}
              onEdgeDirectionCycle={handleGraphTheoryEdgeDirectionCycle}
              onNodeKindSet={handleGraphTheoryNodeKindSet}
              onNodeCostSet={handleGraphTheoryNodeCostSet}
              onNodeLabelSet={handleGraphTheoryNodeLabelSet}
              onNodePositionSet={handleGraphTheoryNodePositionSet}
              showEdgeCosts={effectiveShowGraphEdgeCosts}
            />
          </div>
        ) : appMode === 'graphTheory' && activeTab === 'search' ? (
          <div className="app__searchPanels">
            {selectedGraphSearchAlgorithms.map((algorithm) => {
              const searchState = graphSearchStates[algorithm]
              const solvedPathCost = getSolvedGraphPathCost(searchState)

              return (
                <section key={algorithm} className="app__searchPanel">
                  <header className="app__searchPanelHeader">
                    <h2>{mazeScreenText.graphTheorySearch.options[algorithm]}</h2>
                    <p>
                      {mazeScreenText.search.status.steps}: {searchState.stepCount}
                      {solvedPathCost !== null
                        ? ` / ${mazeScreenText.search.status.cost}: ${solvedPathCost}`
                        : ''}
                      {isSearchPlaying ? ` / ${mazeScreenText.status.playing}` : ''}
                      {searchState.isSolved ? ` / ${mazeScreenText.search.status.solved}` : ''}
                      {searchState.isComplete ? ` / ${mazeScreenText.status.completed}` : ''}
                    </p>
                  </header>
                  <GraphTheoryCanvas
                    currentNodeId={
                      searchState.isComplete || searchState.stepCount === 0
                        ? null
                        : searchState.currentNodeId
                    }
                    graph={graphTheoryData}
                    isNodeLabelVisible={isGraphNodeLabelVisible}
                    nodeTextOrder={graphNodeTextOrder}
                    openNodeIds={searchState.openNodeIds}
                    pathEdgeIds={searchState.pathEdgeIds}
                    pathNodeIds={searchState.pathNodeIds}
                    showEdgeCosts={effectiveShowGraphEdgeCosts}
                    visitedNodeIds={searchState.visitedNodeIds}
                  />
                </section>
              )
            })}
          </div>
        ) : appMode === 'graphTheory' && activeTab === 'play' ? (
          <div className="app__playPanel">
            <div className="app__playPanelHeader">
              <p className="app__playHint">{mazeScreenText.graphTheoryPlay.hint}</p>
              <p className="app__playStatus">
                {mazeScreenText.graphTheoryPlay.steps}: {graphPlayState.stepCount}
                {' / '}
                {mazeScreenText.graphTheoryPlay.cost}: {graphPlayState.totalCost}
                {optimalGraphPlayCost !== null
                  ? ` / ${mazeScreenText.graphTheoryPlay.bestCost}: ${optimalGraphPlayCost}`
                  : ''}
                {graphPlayState.isSolved ? ` / ${mazeScreenText.play.solved}` : ''}
              </p>
            </div>
            <GraphTheoryCanvas
              activeEdgeIds={graphPlayState.reachableEdgeIds}
              activeNodeIds={graphPlayState.reachableNodeIds}
              currentNodeId={graphPlayState.currentNodeId}
              graph={graphTheoryData}
              isNodeLabelVisible={isGraphNodeLabelVisible}
              nodeTextOrder={graphNodeTextOrder}
              onNodeActivate={handleGraphPlayMove}
              pathEdgeIds={graphPlayState.traversedEdgeIds}
              pathNodeIds={graphPlayState.traversedNodeIds}
              showEdgeCosts={effectiveShowGraphEdgeCosts}
            />
          </div>
        ) : appMode === 'graphTheory' ? (
          <GraphTheoryCanvas
            graph={graphTheoryData}
            isNodeLabelVisible={isGraphNodeLabelVisible}
            nodeTextOrder={graphNodeTextOrder}
            showEdgeCosts={effectiveShowGraphEdgeCosts}
          />
        ) : activeTab === 'search' ? (
          <div className="app__searchPanels">
            {selectedSearchAlgorithms.map((algorithm) => {
              const searchState = searchStates[algorithm]
              const solvedPathCost = getSolvedMazePathCost(searchState)

              return (
                <section key={algorithm} className="app__searchPanel">
                  <header className="app__searchPanelHeader">
                    <h2>{mazeScreenText.search.options[algorithm]}</h2>
                    <p>
                      {mazeScreenText.search.status.steps}: {searchState.stepCount}
                      {solvedPathCost !== null
                        ? ` / ${mazeScreenText.search.status.cost}: ${solvedPathCost}`
                        : ''}
                      {isSearchPlaying ? ` / ${mazeScreenText.status.playing}` : ''}
                      {searchState.isSolved ? ` / ${mazeScreenText.search.status.solved}` : ''}
                      {searchState.isComplete ? ` / ${mazeScreenText.status.completed}` : ''}
                    </p>
                  </header>
                  <MazeCanvas
                    displayMode={effectiveDisplayMode}
                    showGraphEdgeCosts={effectiveShowGraphEdgeCosts}
                    maze={generationState.maze}
                    openSet={searchState.openSet}
                    path={searchState.path}
                    visited={searchState.visited}
                    currentCell={
                      searchState.isComplete || searchState.stepCount === 0
                        ? null
                        : searchState.currentCell
                    }
                    currentCellSpan={{ columns: 1, rows: 1 }}
                    cellSize={24}
                  />
                </section>
              )
            })}
          </div>
        ) : activeTab === 'play' ? (
          <div className="app__playPanel">
            <div className="app__playPanelHeader">
              <p className="app__playHint">{mazeScreenText.play.hint}</p>
              <p className="app__playStatus">
                {mazeScreenText.play.steps}: {playerState.stepCount}
                {playerState.isSolved ? ` / ${mazeScreenText.play.solved}` : ''}
              </p>
            </div>
            <MazeCanvas
              bumpState={playerBumpState}
              celebrateGoal={playerState.isSolved}
              currentFacingDirection={playerState.facingDirection}
              displayMode={effectiveDisplayMode}
              showGraphEdgeCosts={effectiveShowGraphEdgeCosts}
              maze={generationState.maze}
              playHandGuideMode={playHandGuideMode}
              playWallVisibilityMode={playWallVisibilityMode}
              revealedWalls={playerState.revealedWalls}
              showVisitedWalls={playWallDiscoveryMode === 'visited'}
              visited={playerState.visited}
              currentCell={playerState.position}
              currentCellSpan={{ columns: 1, rows: 1 }}
              cellSize={24}
              onCellActivate={handlePlayerCellActivate}
            />
          </div>
        ) : (
          <MazeCanvas
            displayMode={effectiveDisplayMode}
            showGraphEdgeCosts={effectiveShowGraphEdgeCosts}
            maze={generationState.maze}
            path={editPreviewPath}
            visited={
              generationState.algorithm === 'wallFilling'
                ? undefined
                : generationState.visited
            }
            currentCell={
              generationState.isComplete || generationState.stepCount === 0
                ? null
                : generationState.currentCell
            }
            currentCellSpan={
              selectedAlgorithm === 'stickFalling' || selectedAlgorithm === 'wallExtending'
                ? { columns: 2, rows: 2 }
                : { columns: 1, rows: 1 }
            }
            cellSize={24}
            editable={activeTab === 'edit'}
            editCostValue={normalizeEdgeCost(editCostInput, 1)}
            editMode={
              editMode === 'move' || editMode === 'direction' || editMode === 'name'
                ? 'wall'
                : editMode
            }
            onCellSelect={handleCellSelect}
            onEdgeCostSet={handleEdgeCostSet}
            onWallToggle={handleWallToggle}
          />
        )}
      </section>

      <aside className="app__sidebar">
        <div
          className={`app__tabs ${appMode === 'graphTheory' ? 'app__tabs--graphTheory' : ''}`}
          role="tablist"
          aria-label="Sidebar tabs"
        >
          {appMode === 'maze' ? (
            <button
              className={`app__tab ${activeTab === 'controls' ? 'app__tab--active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'controls'}
              onClick={() => handleTabChange('controls')}
            >
              {mazeScreenText.tabs.controls}
            </button>
          ) : null}
          <button
            className={`app__tab ${activeTab === 'edit' ? 'app__tab--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'edit'}
            onClick={() => handleTabChange('edit')}
          >
            {mazeScreenText.tabs.edit}
          </button>
          <button
            className={`app__tab ${activeTab === 'display' ? 'app__tab--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'display'}
            onClick={() => handleTabChange('display')}
          >
            {mazeScreenText.tabs.display}
          </button>
          <button
            className={`app__tab ${activeTab === 'search' ? 'app__tab--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'search'}
            onClick={() => handleTabChange('search')}
          >
            {mazeScreenText.tabs.search}
          </button>
          <button
            className={`app__tab ${activeTab === 'play' ? 'app__tab--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'play'}
            onClick={() => handleTabChange('play')}
          >
            {mazeScreenText.tabs.play}
          </button>
        </div>

        <section className="app__controls">
          {appMode === 'graphTheory' && activeTab === 'edit' ? (
            <div className="app__controlsBody">
              <div className="app__field">
                <span className="app__fieldLabel">{mazeScreenText.graphTheory.vertexCountLabel}</span>
                <div className="app__fieldHeaderActions app__fieldHeaderActions--spread">
                  <input
                    className="app__input"
                    type="number"
                    min={MIN_GRAPH_VERTEX_COUNT}
                    max={MAX_GRAPH_VERTEX_COUNT}
                    step={1}
                    value={graphVertexCountInput}
                    onChange={(event) => setGraphVertexCountInput(event.target.value)}
                  />
                  <button
                    className="app__button app__button--compact app__button--secondary"
                    type="button"
                    onClick={handleApplyGraphVertexCount}
                  >
                    {mazeScreenText.graphTheory.applyVertexCount}
                  </button>
                </div>
              </div>
              <div className="app__tabs app__tabs--graphEdit" role="tablist" aria-label="Graph edit modes">
                <button
                  className={`app__tab ${editMode === 'wall' ? 'app__tab--active' : ''}`}
                  type="button"
                  onClick={() => setEditMode('wall')}
                >
                  {mazeScreenText.graphTheory.edgeMode}
                </button>
                <button
                  className={`app__tab ${editMode === 'move' ? 'app__tab--active' : ''}`}
                  type="button"
                  onClick={() => setEditMode('move')}
                >
                  {mazeScreenText.graphTheory.moveMode}
                </button>
                <button
                  className={`app__tab ${editMode === 'direction' ? 'app__tab--active' : ''}`}
                  type="button"
                  onClick={() => setEditMode('direction')}
                >
                  {mazeScreenText.graphTheory.directionMode}
                </button>
                <button
                  className={`app__tab ${editMode === 'name' ? 'app__tab--active' : ''}`}
                  type="button"
                  onClick={() => setEditMode('name')}
                >
                  {mazeScreenText.graphTheory.nameMode}
                </button>
                <button
                  className={`app__tab ${editMode === 'cost' ? 'app__tab--active' : ''}`}
                  type="button"
                  onClick={() => setEditMode('cost')}
                >
                  {mazeScreenText.edit.modes.cost}
                </button>
                <button
                  className={`app__tab ${editMode === 'start' ? 'app__tab--active' : ''}`}
                  type="button"
                  onClick={() => setEditMode('start')}
                >
                  {mazeScreenText.edit.modes.start}
                </button>
                <button
                  className={`app__tab ${editMode === 'goal' ? 'app__tab--active' : ''}`}
                  type="button"
                  onClick={() => setEditMode('goal')}
                >
                  {mazeScreenText.edit.modes.goal}
                </button>
              </div>
              <div className="app__field">
                <span className="app__fieldLabel">{mazeScreenText.edit.goalPathLabel}</span>
                <div className="app__tabs app__tabs--binary" role="tablist" aria-label="Graph edit goal path visibility">
                  <button
                    className={`app__tab ${showGraphTheoryEditGoalPath ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => setShowGraphTheoryEditGoalPath(true)}
                  >
                    {mazeScreenText.edit.goalPathVisible}
                  </button>
                  <button
                    className={`app__tab ${!showGraphTheoryEditGoalPath ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => setShowGraphTheoryEditGoalPath(false)}
                  >
                    {mazeScreenText.edit.goalPathHidden}
                  </button>
                </div>
              </div>
              {editMode === 'wall' ? (
                <div className="app__field">
                  <span className="app__fieldLabel">{mazeScreenText.graphTheory.edgeCostLabel}</span>
                  <div className="app__fieldHeaderActions app__fieldHeaderActions--spread">
                    <input
                      className="app__input"
                      type="number"
                      min={MIN_EDGE_COST}
                      max={MAX_EDGE_COST}
                      step={1}
                      value={graphEdgeCostInput}
                      onChange={(event) => setGraphEdgeCostInput(event.target.value)}
                    />
                  </div>
                  <p className="app__status">{mazeScreenText.graphTheory.edgeConnectHint}</p>
                </div>
              ) : null}
              {editMode === 'move' ? (
                <p className="app__status">{mazeScreenText.graphTheory.moveHint}</p>
              ) : null}
              {editMode === 'direction' ? (
                <p className="app__status">{mazeScreenText.graphTheory.directionHint}</p>
              ) : null}
              {editMode === 'name' ? (
                <div className="app__field">
                  <span className="app__fieldLabel">{mazeScreenText.graphTheory.nodeNameLabel}</span>
                  <div className="app__fieldHeaderActions app__fieldHeaderActions--spread">
                    <input
                      className="app__input"
                      type="text"
                      value={graphNodeLabelInput}
                      onChange={(event) => setGraphNodeLabelInput(event.target.value)}
                    />
                  </div>
                  <p className="app__status">{mazeScreenText.graphTheory.nameHint}</p>
                </div>
              ) : null}
              {editMode === 'cost' ? (
                <div className="app__graphBulkActions">
                  <div className="app__field">
                    <span className="app__fieldLabel">{mazeScreenText.graphTheory.edgeCostLabel}</span>
                    <div className="app__fieldHeaderActions app__fieldHeaderActions--spread">
                      <input
                        className="app__input"
                        type="number"
                        min={MIN_EDGE_COST}
                        max={MAX_EDGE_COST}
                        step={1}
                        value={graphEdgeCostInput}
                        onChange={(event) => setGraphEdgeCostInput(event.target.value)}
                      />
                    </div>
                    <button
                      className="app__button app__button--compact app__button--secondary"
                      type="button"
                      onClick={handleApplyAllGraphTheoryEdgeCosts}
                    >
                      {mazeScreenText.graphTheory.applyAllEdgeCosts}
                    </button>
                  </div>
                  <div className="app__field">
                    <span className="app__fieldLabel">{mazeScreenText.graphTheory.nodeCostLabel}</span>
                    <div className="app__fieldHeaderActions app__fieldHeaderActions--spread">
                      <input
                        className="app__input"
                        type="number"
                        min={MIN_EDGE_COST}
                        max={MAX_EDGE_COST}
                        step={1}
                        value={graphNodeCostInput}
                        onChange={(event) => setGraphNodeCostInput(event.target.value)}
                      />
                    </div>
                    <button
                      className="app__button app__button--compact app__button--secondary"
                      type="button"
                      onClick={handleApplyAllGraphTheoryNodeCosts}
                    >
                      {mazeScreenText.graphTheory.applyAllNodeCosts}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : appMode === 'graphTheory' && activeTab === 'search' ? (
            <div className="app__controlsBody">
              <div className="app__field">
                <div className="app__fieldHeader">
                  <span className="app__fieldLabel">{mazeScreenText.speed.search}</span>
                  <span className="app__fieldMeta">{getPlaybackLabel(searchIntervalMs)}</span>
                </div>
                <input
                  className="app__range"
                  type="range"
                  min={MIN_PLAYBACK_INTERVAL_MS}
                  max={MAX_PLAYBACK_INTERVAL_MS}
                  step={10}
                  value={MAX_PLAYBACK_INTERVAL_MS + MIN_PLAYBACK_INTERVAL_MS - searchIntervalMs}
                  onChange={(event) =>
                    setSearchIntervalMs(
                      MAX_PLAYBACK_INTERVAL_MS +
                        MIN_PLAYBACK_INTERVAL_MS -
                        Number(event.target.value),
                    )
                  }
                />
                <div className="app__rangeLabels" aria-hidden="true">
                  <span>{mazeScreenText.speed.slow}</span>
                  <span>{mazeScreenText.speed.fast}</span>
                </div>
              </div>
              <div className="app__field">
                <span className="app__fieldLabel">
                  {mazeScreenText.graphTheorySearch.algorithmLabel}
                </span>
                <div
                  className="app__tabs app__tabs--stacked"
                  role="tablist"
                  aria-label="Graph theory search algorithms"
                >
                  {GRAPH_THEORY_SEARCH_ALGORITHM_OPTIONS.map((algorithm) => (
                    <button
                      key={algorithm.value}
                      className={`app__tab ${
                        selectedGraphSearchAlgorithms.includes(algorithm.value)
                          ? 'app__tab--active'
                          : ''
                      }`}
                      type="button"
                      onClick={() => handleGraphSearchAlgorithmToggle(algorithm.value)}
                    >
                      {algorithm.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : appMode === 'graphTheory' && activeTab === 'play' ? (
            <div className="app__controlsBody">
              <p className="app__status">{mazeScreenText.graphTheoryPlay.ruleSummary}</p>
              <div className="app__graphSummary">
                <span>
                  {mazeScreenText.graphTheoryPlay.current}:{' '}
                  {graphTheoryData.nodes[graphPlayState.currentNodeId]?.label}
                </span>
                <span>
                  {mazeScreenText.graphTheoryPlay.cost}: {graphPlayState.totalCost}
                </span>
                {optimalGraphPlayCost !== null ? (
                  <span>
                    {mazeScreenText.graphTheoryPlay.bestCost}: {optimalGraphPlayCost}
                  </span>
                ) : null}
              </div>
            </div>
          ) : appMode === 'graphTheory' ? (
            <div className="app__controlsBody">
              <div className="app__field">
                <span className="app__fieldLabel">{mazeScreenText.graphTheory.vertexCountLabel}</span>
                <div className="app__fieldHeaderActions app__fieldHeaderActions--spread">
                  <input
                    className="app__input"
                    type="number"
                    min={MIN_GRAPH_VERTEX_COUNT}
                    max={MAX_GRAPH_VERTEX_COUNT}
                    step={1}
                    value={graphVertexCountInput}
                    onChange={(event) => setGraphVertexCountInput(event.target.value)}
                  />
                  <button
                    className="app__button app__button--compact app__button--secondary"
                    type="button"
                    onClick={handleApplyGraphVertexCount}
                  >
                    {mazeScreenText.graphTheory.applyVertexCount}
                  </button>
                </div>
              </div>
              <div className="app__field">
                <span className="app__fieldLabel">{mazeScreenText.graphEdgeCosts.label}</span>
                <div className="app__tabs app__tabs--search" role="tablist" aria-label="Graph edge cost labels">
                  <button
                    className={`app__tab ${showGraphEdgeCosts ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => setShowGraphEdgeCosts(true)}
                  >
                    {mazeScreenText.graphEdgeCosts.visible}
                  </button>
                  <button
                    className={`app__tab ${!showGraphEdgeCosts ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => setShowGraphEdgeCosts(false)}
                  >
                    {mazeScreenText.graphEdgeCosts.hidden}
                  </button>
                </div>
              </div>
              <div className="app__field">
                <span className="app__fieldLabel">{mazeScreenText.graphTheory.nodeLabelVisibilityLabel}</span>
                <div className="app__tabs app__tabs--search" role="tablist" aria-label="Graph node label visibility">
                  <button
                    className={`app__tab ${isGraphNodeLabelVisible ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => setIsGraphNodeLabelVisible(true)}
                  >
                    {mazeScreenText.graphTheory.nodeLabelVisibilityVisible}
                  </button>
                  <button
                    className={`app__tab ${!isGraphNodeLabelVisible ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => setIsGraphNodeLabelVisible(false)}
                  >
                    {mazeScreenText.graphTheory.nodeLabelVisibilityHidden}
                  </button>
                </div>
              </div>
              <div className="app__field">
                <span className="app__fieldLabel">{mazeScreenText.graphTheory.nodeTextOrderLabel}</span>
                <div className="app__tabs app__tabs--search" role="tablist" aria-label="Graph node text order">
                  <button
                    className={`app__tab ${graphNodeTextOrder === 'labelFirst' ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => setGraphNodeTextOrder('labelFirst')}
                  >
                    {mazeScreenText.graphTheory.nodeTextOrderLabelFirst}
                  </button>
                  <button
                    className={`app__tab ${graphNodeTextOrder === 'costFirst' ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => setGraphNodeTextOrder('costFirst')}
                  >
                    {mazeScreenText.graphTheory.nodeTextOrderCostFirst}
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'edit' ? (
            <>
              <div className="app__controlsBody">
                <p className="app__status">{mazeScreenText.edit.hint}</p>
                <div className="app__tabs app__tabs--edit" role="tablist" aria-label="Edit modes">
                  <button
                    className={`app__tab ${editMode === 'wall' ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => {
                      setEditMode('wall')
                    }}
                  >
                    {mazeScreenText.edit.modes.wall}
                  </button>
                  <button
                    className={`app__tab ${editMode === 'cost' ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => {
                      setEditMode('cost')
                    }}
                  >
                    {mazeScreenText.edit.modes.cost}
                  </button>
                  <button
                    className={`app__tab ${editMode === 'start' ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => {
                      setEditMode('start')
                    }}
                  >
                    {mazeScreenText.edit.modes.start}
                  </button>
                  <button
                    className={`app__tab ${editMode === 'goal' ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => {
                      setEditMode('goal')
                    }}
                  >
                    {mazeScreenText.edit.modes.goal}
                  </button>
                </div>
                <div className="app__field">
                  <span className="app__fieldLabel">{mazeScreenText.edit.goalPathLabel}</span>
                  <div className="app__tabs app__tabs--binary" role="tablist" aria-label="Edit goal path visibility">
                    <button
                      className={`app__tab ${showEditGoalPath ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setShowEditGoalPath(true)}
                    >
                      {mazeScreenText.edit.goalPathVisible}
                    </button>
                    <button
                      className={`app__tab ${!showEditGoalPath ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setShowEditGoalPath(false)}
                    >
                      {mazeScreenText.edit.goalPathHidden}
                    </button>
                  </div>
                </div>
                {editMode === 'cost' ? (
                  <div className="app__field">
                    <span className="app__fieldLabel">{mazeScreenText.edit.costLabel}</span>
                    <div className="app__fieldHeaderActions app__fieldHeaderActions--spread">
                      <input
                        className="app__input"
                        type="number"
                        min={MIN_EDGE_COST}
                        max={MAX_EDGE_COST}
                        step={1}
                        value={editCostInput}
                        onChange={(event) => setEditCostInput(event.target.value)}
                      />
                      <button
                        className="app__button app__button--compact app__button--secondary"
                        type="button"
                        onClick={handleApplyAllEdgeCosts}
                      >
                        {mazeScreenText.edit.applyAllCosts}
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="app__sizeFields">
                  <label className="app__field">
                    <span className="app__fieldLabel">{mazeScreenText.size.columns}</span>
                    <input
                      className="app__input"
                      type="number"
                      min={MIN_DIMENSION}
                      step={1}
                      value={dimensionInputs.columns}
                      onChange={(event) =>
                        setDimensionInputs((current) => ({
                          ...current,
                          columns: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="app__field">
                    <span className="app__fieldLabel">{mazeScreenText.size.rows}</span>
                    <input
                      className="app__input"
                      type="number"
                      min={MIN_DIMENSION}
                      step={1}
                      value={dimensionInputs.rows}
                      onChange={(event) =>
                        setDimensionInputs((current) => ({
                          ...current,
                          rows: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="app__field">
                  <div className="app__fieldHeader">
                    <span className="app__fieldLabel">
                      {mazeScreenText.importExport.label}
                    </span>
                    <div className="app__fieldHeaderActions">
                      <button
                        className="app__button app__button--compact"
                        onClick={handleImportFromTextArea}
                        disabled={mazeTransferText.trim().length === 0}
                      >
                        {mazeScreenText.importExport.importText}
                      </button>
                      <input
                        ref={importFileInputRef}
                        className="app__srOnly"
                        type="file"
                        accept="application/json,.json"
                        onChange={handleImportFileChange}
                      />
                    </div>
                  </div>
                  <textarea
                    className="app__textarea"
                    value={mazeTransferText}
                    placeholder={mazeScreenText.importExport.placeholder}
                    onChange={(event) => {
                      setMazeTransferText(event.target.value)
                      setToast(null)
                    }}
                  />
                </div>
              </div>
            </>
          ) : activeTab === 'display' ? (
            <>
              <div className="app__controlsBody">
                <div className="app__field">
                  <span className="app__fieldLabel">{mazeScreenText.displayMode.label}</span>
                  <div className="app__tabs app__tabs--search" role="tablist" aria-label="Display mode">
                    <button
                      className={`app__tab ${displayMode === 'maze' ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setDisplayMode('maze')}
                    >
                      {mazeScreenText.displayMode.maze}
                    </button>
                    <button
                      className={`app__tab ${displayMode === 'graph' ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setDisplayMode('graph')}
                    >
                      {mazeScreenText.displayMode.graph}
                    </button>
                  </div>
                </div>
                <div className="app__field">
                  <span className="app__fieldLabel">{mazeScreenText.graphEdgeCosts.label}</span>
                  <div className="app__tabs app__tabs--search" role="tablist" aria-label="Graph edge cost labels">
                    <button
                      className={`app__tab ${showGraphEdgeCosts ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setShowGraphEdgeCosts(true)}
                    >
                      {mazeScreenText.graphEdgeCosts.visible}
                    </button>
                    <button
                      className={`app__tab ${!showGraphEdgeCosts ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setShowGraphEdgeCosts(false)}
                    >
                      {mazeScreenText.graphEdgeCosts.hidden}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'search' ? (
            <>
              <div className="app__controlsBody">
                <div className="app__field">
                  <div className="app__fieldHeader">
                    <span className="app__fieldLabel">{mazeScreenText.speed.search}</span>
                    <span className="app__fieldMeta">{getPlaybackLabel(searchIntervalMs)}</span>
                  </div>
                  <input
                    className="app__range"
                    type="range"
                    min={MIN_PLAYBACK_INTERVAL_MS}
                    max={MAX_PLAYBACK_INTERVAL_MS}
                    step={10}
                    value={MAX_PLAYBACK_INTERVAL_MS + MIN_PLAYBACK_INTERVAL_MS - searchIntervalMs}
                    onChange={(event) =>
                      setSearchIntervalMs(
                        MAX_PLAYBACK_INTERVAL_MS +
                          MIN_PLAYBACK_INTERVAL_MS -
                          Number(event.target.value),
                      )
                    }
                  />
                  <div className="app__rangeLabels" aria-hidden="true">
                    <span>{mazeScreenText.speed.slow}</span>
                    <span>{mazeScreenText.speed.fast}</span>
                  </div>
                </div>
                <div className="app__field">
                  <span className="app__fieldLabel">
                    {mazeScreenText.search.algorithmLabel}
                  </span>
                  <div
                    className="app__tabs app__tabs--stacked"
                    role="tablist"
                    aria-label="Search algorithms"
                  >
                    {MAZE_SEARCH_ALGORITHM_OPTIONS.map((algorithm) => (
                      <button
                        key={algorithm.value}
                        className={`app__tab ${
                          selectedSearchAlgorithms.includes(algorithm.value)
                            ? 'app__tab--active'
                            : ''
                        }`}
                        type="button"
                        onClick={() => handleSearchAlgorithmToggle(algorithm.value)}
                      >
                        {algorithm.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'play' ? (
            <>
              <div className="app__controlsBody">
                <div className="app__field">
                  <span className="app__fieldLabel">{mazeScreenText.play.clickMoveLabel}</span>
                  <div
                    className="app__tabs app__tabs--search"
                    role="tablist"
                    aria-label="Click move settings"
                  >
                    <button
                      className={`app__tab ${playClickMoveMode === 'enabled' ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setPlayClickMoveMode('enabled')}
                    >
                      {mazeScreenText.play.clickMoveEnabled}
                    </button>
                    <button
                      className={`app__tab ${playClickMoveMode === 'disabled' ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setPlayClickMoveMode('disabled')}
                    >
                      {mazeScreenText.play.clickMoveDisabled}
                    </button>
                  </div>
                </div>
                <div className="app__field">
                  <span className="app__fieldLabel">{mazeScreenText.play.wallLabel}</span>
                <div className="app__tabs app__tabs--playWalls" role="tablist" aria-label="Play wall settings">
                  <button
                    className={`app__tab ${playWallVisibilityMode === 'all' ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => setPlayWallVisibilityMode('all')}
                  >
                    {mazeScreenText.play.wallVisible}
                  </button>
                  <button
                    className={`app__tab ${playWallVisibilityMode === 'nearby' ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => setPlayWallVisibilityMode('nearby')}
                  >
                    {mazeScreenText.play.wallNearby}
                  </button>
                  <button
                    className={`app__tab ${playWallVisibilityMode === 'hidden' ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => setPlayWallVisibilityMode('hidden')}
                  >
                    {mazeScreenText.play.wallHidden}
                  </button>
                  </div>
                </div>
                <div className="app__field">
                  <span className="app__fieldLabel">{mazeScreenText.play.discoveredWallLabel}</span>
                  <div
                    className="app__tabs app__tabs--stacked"
                    role="tablist"
                    aria-label="Discovered wall settings"
                  >
                    <button
                      className={`app__tab ${playWallDiscoveryMode === 'bumpOnly' ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setPlayWallDiscoveryMode('bumpOnly')}
                    >
                      {mazeScreenText.play.discoveredWallBumpOnly}
                    </button>
                    <button
                      className={`app__tab ${playWallDiscoveryMode === 'visited' ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setPlayWallDiscoveryMode('visited')}
                    >
                      {mazeScreenText.play.discoveredWallVisited}
                    </button>
                    <button
                      className={`app__tab ${playWallDiscoveryMode === 'hidden' ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setPlayWallDiscoveryMode('hidden')}
                    >
                      {mazeScreenText.play.discoveredWallHidden}
                    </button>
                  </div>
                </div>
                <div className="app__field">
                  <span className="app__fieldLabel">{mazeScreenText.play.handGuideLabel}</span>
                  <div
                    className="app__tabs app__tabs--stacked"
                    role="tablist"
                    aria-label="Hand guide settings"
                  >
                    <button
                      className={`app__tab ${playHandGuideMode === 'right' ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setPlayHandGuideMode('right')}
                    >
                      {mazeScreenText.play.handGuideRight}
                    </button>
                    <button
                      className={`app__tab ${playHandGuideMode === 'left' ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setPlayHandGuideMode('left')}
                    >
                      {mazeScreenText.play.handGuideLeft}
                    </button>
                    <button
                      className={`app__tab ${playHandGuideMode === 'hidden' ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setPlayHandGuideMode('hidden')}
                    >
                      {mazeScreenText.play.handGuideHidden}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'controls' ? (
            <>
              <div className="app__controlsBody">
                <div className="app__field">
                  <div className="app__fieldHeader">
                    <span className="app__fieldLabel">{mazeScreenText.speed.generation}</span>
                    <span className="app__fieldMeta">{getPlaybackLabel(generationIntervalMs)}</span>
                  </div>
                  <input
                    className="app__range"
                    type="range"
                    min={MIN_PLAYBACK_INTERVAL_MS}
                    max={MAX_PLAYBACK_INTERVAL_MS}
                    step={10}
                    value={
                      MAX_PLAYBACK_INTERVAL_MS +
                      MIN_PLAYBACK_INTERVAL_MS -
                      generationIntervalMs
                    }
                    onChange={(event) =>
                      setGenerationIntervalMs(
                        MAX_PLAYBACK_INTERVAL_MS +
                          MIN_PLAYBACK_INTERVAL_MS -
                          Number(event.target.value),
                      )
                    }
                  />
                  <div className="app__rangeLabels" aria-hidden="true">
                    <span>{mazeScreenText.speed.slow}</span>
                    <span>{mazeScreenText.speed.fast}</span>
                  </div>
                </div>
                <label className="app__field">
                  <span className="app__fieldLabel">{mazeScreenText.algorithm.label}</span>
                  <select
                    className="app__input"
                    value={selectedAlgorithm}
                    onChange={(event) =>
                      handleAlgorithmChange(event.target.value as MazeAlgorithm)
                    }
                  >
                    {MAZE_ALGORITHM_OPTIONS.map((algorithm) => (
                      <option key={algorithm.value} value={algorithm.value}>
                        {algorithm.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="app__sizeFields">
                  <label className="app__field">
                    <span className="app__fieldLabel">{mazeScreenText.size.columns}</span>
                    <input
                      className="app__input"
                      type="number"
                      min={MIN_DIMENSION}
                      step={1}
                      value={dimensionInputs.columns}
                      onChange={(event) =>
                        setDimensionInputs((current) => ({
                          ...current,
                          columns: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="app__field">
                    <span className="app__fieldLabel">{mazeScreenText.size.rows}</span>
                    <input
                      className="app__input"
                      type="number"
                      min={MIN_DIMENSION}
                      step={1}
                      value={dimensionInputs.rows}
                      onChange={(event) =>
                        setDimensionInputs((current) => ({
                          ...current,
                          rows: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="app__field">
                  <div className="app__fieldHeader">
                    <span className="app__fieldLabel">{mazeScreenText.seed.label}</span>
                    <button
                      className="app__button app__button--compact"
                      type="button"
                      onClick={handleRandomizeSeed}
                    >
                      {mazeScreenText.seed.randomize}
                    </button>
                  </div>
                  <input
                    className="app__input"
                    type="number"
                    step={1}
                    value={seedInput}
                    disabled={!useSeed}
                    onChange={(event) => setSeedInput(event.target.value)}
                  />
                </div>
                <div className="app__field">
                  <span className="app__fieldLabel">{mazeScreenText.seed.modeLabel}</span>
                  <div className="app__tabs app__tabs--search" role="tablist" aria-label="Seed mode">
                    <button
                      className={`app__tab ${useSeed ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setUseSeed(true)}
                    >
                      {mazeScreenText.seed.enabled}
                    </button>
                    <button
                      className={`app__tab ${!useSeed ? 'app__tab--active' : ''}`}
                      type="button"
                      onClick={() => setUseSeed(false)}
                    >
                      {mazeScreenText.seed.disabled}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : null
          }
        </section>
      </aside>

      {toast ? (
        <div
          className={`app__toast app__toast--${toast.tone}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  )
}

export default MazeScreen
