import { type ChangeEvent, useEffect, useRef, useState } from 'react'
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
  stepMazeGeneration,
  toggleMazeWall,
} from '../data/mazeGenerator'
import {
  MAZE_SEARCH_ALGORITHM_OPTIONS,
  completeMazeSearch,
  createMazeSearchState,
  stepMazeSearch,
  type MazeSearchState,
  type MazeSearchAlgorithm,
} from '../data/mazeSearch'
import {
  buildMazeTransferPayload,
  downloadMazeTransferPayload,
} from '../data/mazeTransfer.export'
import { parseMazeTransferPayload } from '../data/mazeTransfer.import'
import { createDefaultGraphTheoryData } from '../data/graphTheory'
import mazeScreenText from '../text/mazeScreen.json'

const DEFAULT_GENERATION_INTERVAL_MS = 40
const DEFAULT_SEARCH_INTERVAL_MS = 40
const MAX_PLAYBACK_INTERVAL_MS = 180
const MIN_PLAYBACK_INTERVAL_MS = 20
const MIN_DIMENSION = 2
const MIN_EDGE_COST = 0
const MAX_EDGE_COST = 99
type AppMode = 'maze' | 'graphTheory'
type SidebarTab = 'controls' | 'display' | 'edit' | 'play' | 'search'
type PlayHandGuideMode = 'hidden' | 'left' | 'right'
type PlayWallVisibilityMode = 'all' | 'hidden' | 'nearby'
type PlayWallDiscoveryMode = 'bumpOnly' | 'hidden' | 'visited'
type SearchStateMap = Record<MazeSearchAlgorithm, MazeSearchState>
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

function createSearchStateMap(
  maze: MazeSearchState['maze'],
): SearchStateMap {
  return {
    astar: createMazeSearchState(maze, 'astar'),
    bfs: createMazeSearchState(maze, 'bfs'),
    deadEndFilling: createMazeSearchState(maze, 'deadEndFilling'),
    dfs: createMazeSearchState(maze, 'dfs'),
    goalPruning: createMazeSearchState(maze, 'goalPruning'),
    humanAstar: createMazeSearchState(maze, 'humanAstar'),
    leftHand: createMazeSearchState(maze, 'leftHand'),
    tremaux: createMazeSearchState(maze, 'tremaux'),
    rightHand: createMazeSearchState(maze, 'rightHand'),
  }
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

function getDirectionBetween(
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

function getSolvedPathCost(searchState: MazeSearchState) {
  if (!searchState.isSolved) {
    return null
  }

  let totalCost = 0
  let current = searchState.goal

  while (!(current.x === searchState.start.x && current.y === searchState.start.y)) {
    const parent = searchState.parents[current.y][current.x]

    if (!parent) {
      return null
    }

    const direction = getDirectionBetween(parent, current)

    if (!direction) {
      return null
    }

    totalCost += searchState.maze[parent.y][parent.x].costs[direction]
    current = parent
  }

  return totalCost
}

function MazeScreen() {
  const importFileInputRef = useRef<HTMLInputElement | null>(null)
  const [appMode, setAppMode] = useState<AppMode>('maze')
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<MazeAlgorithm>('digging')
  const [selectedSearchAlgorithms, setSelectedSearchAlgorithms] = useState<
    MazeSearchAlgorithm[]
  >(['astar'])
  const [generationState, setGenerationState] = useState(() =>
    createMazeGenerationState(DEFAULT_MAZE_DIMENSIONS, 'digging', null),
  )
  const [searchStates, setSearchStates] = useState<SearchStateMap>(() =>
    createSearchStateMap(
      createMazeGenerationState(DEFAULT_MAZE_DIMENSIONS, 'digging', null).maze,
    ),
  )
  const [playerState, setPlayerState] = useState<PlayerState>(() =>
    createPlayerState(
      createMazeGenerationState(DEFAULT_MAZE_DIMENSIONS, 'digging', null).maze,
    ),
  )
  const [playerBumpState, setPlayerBumpState] = useState<PlayerBumpState | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSearchPlaying, setIsSearchPlaying] = useState(false)
  const [generationIntervalMs, setGenerationIntervalMs] = useState(DEFAULT_GENERATION_INTERVAL_MS)
  const [searchIntervalMs, setSearchIntervalMs] = useState(DEFAULT_SEARCH_INTERVAL_MS)
  const [activeTab, setActiveTab] = useState<SidebarTab>('controls')
  const [editMode, setEditMode] = useState<MazeEditMode>('wall')
  const [displayMode, setDisplayMode] = useState<MazeDisplayMode>('maze')
  const [showGraphEdgeCosts, setShowGraphEdgeCosts] = useState(false)
  const [playHandGuideMode, setPlayHandGuideMode] = useState<PlayHandGuideMode>('hidden')
  const [playWallDiscoveryMode, setPlayWallDiscoveryMode] =
    useState<PlayWallDiscoveryMode>('visited')
  const [playWallVisibilityMode, setPlayWallVisibilityMode] =
    useState<PlayWallVisibilityMode>('all')
  const [mazeTransferText, setMazeTransferText] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [editCostInput, setEditCostInput] = useState('1')
  const [dimensionInputs, setDimensionInputs] = useState({
    columns: String(DEFAULT_MAZE_DIMENSIONS.columns),
    rows: String(DEFAULT_MAZE_DIMENSIONS.rows),
  })
  const [seedInput, setSeedInput] = useState(String(DEFAULT_MAZE_SEED))
  const [useSeed, setUseSeed] = useState(false)
  const graphTheoryData = createDefaultGraphTheoryData(7)
  const graphVertexCount = graphTheoryData.nodes.length
  const graphEdgeCount = graphTheoryData.edges.length
  const effectiveDisplayMode: MazeDisplayMode =
    appMode === 'graphTheory' ? 'graph' : displayMode
  const effectiveShowGraphEdgeCosts =
    appMode === 'graphTheory'
      ? true
      : activeTab === 'edit' && editMode === 'cost'
        ? true
        : showGraphEdgeCosts

  useEffect(() => {
    if (!isPlaying || generationState.isComplete) {
      return
    }

    const timerId = window.setInterval(() => {
      setGenerationState((currentState) => stepMazeGeneration(currentState))
    }, generationIntervalMs)

    return () => {
      window.clearInterval(timerId)
    }
  }, [generationIntervalMs, generationState.isComplete, isPlaying])

  useEffect(() => {
    if (
      !isSearchPlaying ||
      selectedSearchAlgorithms.every((algorithm) => searchStates[algorithm].isComplete)
    ) {
      return
    }

    const timerId = window.setInterval(() => {
      setSearchStates((currentStates) => {
        const nextStates = { ...currentStates }

        for (const algorithm of selectedSearchAlgorithms) {
          nextStates[algorithm] = stepMazeSearch(nextStates[algorithm])
        }

        return nextStates
      })
    }, searchIntervalMs)

    return () => {
      window.clearInterval(timerId)
    }
  }, [isSearchPlaying, searchIntervalMs, selectedSearchAlgorithms])

  useEffect(() => {
    if (generationState.isComplete) {
      setIsPlaying(false)
    }
  }, [generationState.isComplete])

  useEffect(() => {
    if (selectedSearchAlgorithms.every((algorithm) => searchStates[algorithm].isComplete)) {
      setIsSearchPlaying(false)
    }
  }, [searchStates, selectedSearchAlgorithms])

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
    setSearchStates(createSearchStateMap(generationState.maze))
    setPlayerState(createPlayerState(generationState.maze))
    setPlayerBumpState(null)
  }, [generationState.maze])

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
    setGenerationState((currentState) => stepMazeGeneration(currentState))
  }

  function handlePlayToggle() {
    setIsPlaying((currentState) => !currentState)
  }

  function handleSearchStep() {
    setSearchStates((currentStates) => {
      const nextStates = { ...currentStates }

      for (const algorithm of selectedSearchAlgorithms) {
        nextStates[algorithm] = stepMazeSearch(nextStates[algorithm])
      }

      return nextStates
    })
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

    setActiveTab(nextTab)
  }

  function handleAppModeChange(nextMode: AppMode) {
    setIsPlaying(false)
    setIsSearchPlaying(false)
    setAppMode(nextMode)
  }

  function handleComplete() {
    setIsPlaying(false)
    setGenerationState((currentState) => completeMazeGeneration(currentState))
  }

  function handleSearchComplete() {
    setIsSearchPlaying(false)
    setSearchStates((currentStates) => {
      const nextStates = { ...currentStates }

      for (const algorithm of selectedSearchAlgorithms) {
        nextStates[algorithm] = completeMazeSearch(nextStates[algorithm])
      }

      return nextStates
    })
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
    setSearchStates(createSearchStateMap(generationState.maze))
  }

  function handlePlayReset() {
    setPlayerState(createPlayerState(generationState.maze))
    setPlayerBumpState(null)
  }

  function handlePlayGenerate() {
    const nextDimensions = buildDimensionsFromInputs()
    const nextSeed = resolveGenerationSeed()
    const nextState = completeMazeGeneration(
      createMazeGenerationState(nextDimensions, selectedAlgorithm, nextSeed),
    )

    setIsPlaying(false)
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
    setSelectedSearchAlgorithms((currentAlgorithms) => {
      if (currentAlgorithms.includes(nextAlgorithm)) {
        if (currentAlgorithms.length === 1) {
          return currentAlgorithms
        }

        return currentAlgorithms.filter((algorithm) => algorithm !== nextAlgorithm)
      }

      return [...currentAlgorithms, nextAlgorithm]
    })
  }

  const areSelectedSearchesComplete = selectedSearchAlgorithms.every(
    (algorithm) => searchStates[algorithm].isComplete,
  )

  function handlePlayerMove(direction: MazeWallDirection) {
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

  function handleWallToggle(
    position: { x: number; y: number },
    direction: MazeWallDirection,
  ) {
    setIsPlaying(false)
    setGenerationState((currentState) => toggleMazeWall(currentState, position, direction))
  }

  function handleCellSelect(position: { x: number; y: number }) {
    if (editMode === 'wall' || editMode === 'cost') {
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
        {appMode === 'graphTheory' ? (
          <GraphTheoryCanvas
            graph={graphTheoryData}
            showEdgeCosts={showGraphEdgeCosts}
          />
        ) : activeTab === 'search' ? (
          <div className="app__searchPanels">
            {selectedSearchAlgorithms.map((algorithm) => {
              const searchState = searchStates[algorithm]
              const solvedPathCost = getSolvedPathCost(searchState)

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
            />
          </div>
        ) : (
          <MazeCanvas
            displayMode={effectiveDisplayMode}
            showGraphEdgeCosts={effectiveShowGraphEdgeCosts}
            maze={generationState.maze}
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
            editMode={editMode}
            onCellSelect={handleCellSelect}
            onEdgeCostSet={handleEdgeCostSet}
            onWallToggle={handleWallToggle}
          />
        )}
      </section>

      <aside className="app__sidebar">
        <div className="app__tabs" role="tablist" aria-label="Sidebar tabs">
          <button
            className={`app__tab ${activeTab === 'controls' ? 'app__tab--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'controls'}
            onClick={() => handleTabChange('controls')}
          >
            {mazeScreenText.tabs.controls}
          </button>
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
          {appMode === 'graphTheory' ? (
            <div className="app__controlsBody">
              <p className="app__status">{mazeScreenText.graphTheory.hint}</p>
              <div className="app__field">
                <span className="app__fieldLabel">
                  {mazeScreenText.graphTheory.summaryLabel}
                </span>
                <div className="app__graphSummary">
                  <span>
                    {mazeScreenText.graphTheory.vertices}: {graphVertexCount}
                  </span>
                  <span>
                    {mazeScreenText.graphTheory.edges}: {graphEdgeCount}
                  </span>
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
