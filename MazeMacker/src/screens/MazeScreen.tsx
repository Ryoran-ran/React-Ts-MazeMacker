import { useEffect, useState } from 'react'
import MazeCanvas, {
  type MazeEditMode,
  type MazeData,
  type MazeWallDirection,
} from '../components/MazeCanvas'
import {
  DEFAULT_MAZE_DIMENSIONS,
  MAZE_ALGORITHM_OPTIONS,
  type MazeAlgorithm,
  type MazeCellKind,
  type MazeDimensions,
  completeMazeGeneration,
  createMazeGenerationState,
  setMazeCellKind,
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
import mazeScreenText from '../text/mazeScreen.json'

const PLAY_INTERVAL_MS = 40
const MIN_DIMENSION = 2
type SidebarTab = 'controls' | 'settings' | 'edit' | 'play' | 'search'
type PlayHandGuideMode = 'hidden' | 'left' | 'right'
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

function normalizeDimension(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) {
    return fallback
  }

  return Math.max(MIN_DIMENSION, parsed)
}

function createSearchStateMap(
  maze: MazeSearchState['maze'],
): SearchStateMap {
  return {
    astar: createMazeSearchState(maze, 'astar'),
    bfs: createMazeSearchState(maze, 'bfs'),
    dfs: createMazeSearchState(maze, 'dfs'),
    leftHand: createMazeSearchState(maze, 'leftHand'),
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

function MazeScreen() {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<MazeAlgorithm>('digging')
  const [selectedSearchAlgorithms, setSelectedSearchAlgorithms] = useState<
    MazeSearchAlgorithm[]
  >(['bfs', 'dfs'])
  const [generationState, setGenerationState] = useState(() =>
    createMazeGenerationState(DEFAULT_MAZE_DIMENSIONS, 'digging'),
  )
  const [searchStates, setSearchStates] = useState<SearchStateMap>(() =>
    createSearchStateMap(createMazeGenerationState(DEFAULT_MAZE_DIMENSIONS, 'digging').maze),
  )
  const [playerState, setPlayerState] = useState<PlayerState>(() =>
    createPlayerState(createMazeGenerationState(DEFAULT_MAZE_DIMENSIONS, 'digging').maze),
  )
  const [playerBumpState, setPlayerBumpState] = useState<PlayerBumpState | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSearchPlaying, setIsSearchPlaying] = useState(false)
  const [activeTab, setActiveTab] = useState<SidebarTab>('controls')
  const [editMode, setEditMode] = useState<MazeEditMode>('wall')
  const [playHandGuideMode, setPlayHandGuideMode] = useState<PlayHandGuideMode>('hidden')
  const [playWallDiscoveryMode, setPlayWallDiscoveryMode] =
    useState<PlayWallDiscoveryMode>('visited')
  const [showWallsInPlay, setShowWallsInPlay] = useState(true)
  const [dimensionInputs, setDimensionInputs] = useState({
    columns: String(DEFAULT_MAZE_DIMENSIONS.columns),
    rows: String(DEFAULT_MAZE_DIMENSIONS.rows),
  })

  useEffect(() => {
    if (!isPlaying || generationState.isComplete) {
      return
    }

    const timerId = window.setInterval(() => {
      setGenerationState((currentState) => stepMazeGeneration(currentState))
    }, PLAY_INTERVAL_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [generationState.isComplete, isPlaying])

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
    }, PLAY_INTERVAL_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [isSearchPlaying, selectedSearchAlgorithms])

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

  function handleApplyDimensions() {
    const nextDimensions = buildDimensionsFromInputs()

    setIsPlaying(false)
    setDimensionInputs({
      columns: String(nextDimensions.columns),
      rows: String(nextDimensions.rows),
    })
    setGenerationState(createMazeGenerationState(nextDimensions, selectedAlgorithm))
  }

  function handleReset() {
    const nextDimensions = buildDimensionsFromInputs()

    setIsPlaying(false)
    setDimensionInputs({
      columns: String(nextDimensions.columns),
      rows: String(nextDimensions.rows),
    })
    setGenerationState(createMazeGenerationState(nextDimensions, selectedAlgorithm))
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
    const nextState = completeMazeGeneration(
      createMazeGenerationState(nextDimensions, selectedAlgorithm),
    )

    setIsPlaying(false)
    setDimensionInputs({
      columns: String(nextDimensions.columns),
      rows: String(nextDimensions.rows),
    })
    setGenerationState(nextState)
  }

  function handleAlgorithmChange(nextAlgorithm: MazeAlgorithm) {
    const nextDimensions = buildDimensionsFromInputs()

    setIsPlaying(false)
    setSelectedAlgorithm(nextAlgorithm)
    setGenerationState(createMazeGenerationState(nextDimensions, nextAlgorithm))
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
    if (editMode === 'wall') {
      return
    }

    const nextKind: MazeCellKind = editMode === 'start' ? 'start' : 'goal'
    setIsPlaying(false)
    setGenerationState((currentState) => setMazeCellKind(currentState, position, nextKind))
  }

  return (
    <main className="app">
      <header className="app__topbar">
        <h1>{mazeScreenText.title}</h1>
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
      </header>

      <section className="app__panel">
        {activeTab === 'search' ? (
          <div className="app__searchPanels">
            {selectedSearchAlgorithms.map((algorithm) => {
              const searchState = searchStates[algorithm]

              return (
                <section key={algorithm} className="app__searchPanel">
                  <header className="app__searchPanelHeader">
                    <h2>{mazeScreenText.search.options[algorithm]}</h2>
                    <p>
                      {mazeScreenText.search.status.steps}: {searchState.stepCount}
                      {isSearchPlaying ? ` / ${mazeScreenText.status.playing}` : ''}
                      {searchState.isSolved ? ` / ${mazeScreenText.search.status.solved}` : ''}
                      {searchState.isComplete ? ` / ${mazeScreenText.status.completed}` : ''}
                    </p>
                  </header>
                  <MazeCanvas
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
            <p className="app__playHint">{mazeScreenText.play.hint}</p>
            <MazeCanvas
              bumpState={playerBumpState}
              currentFacingDirection={playerState.facingDirection}
              maze={generationState.maze}
              playHandGuideMode={playHandGuideMode}
              revealedWalls={playerState.revealedWalls}
              showVisitedWalls={playWallDiscoveryMode === 'visited'}
              showWalls={showWallsInPlay}
              visited={playerState.visited}
              currentCell={playerState.position}
              currentCellSpan={{ columns: 1, rows: 1 }}
              cellSize={24}
            />
          </div>
        ) : (
          <MazeCanvas
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
            editMode={editMode}
            onCellSelect={handleCellSelect}
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
            className={`app__tab ${activeTab === 'settings' ? 'app__tab--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'settings'}
            onClick={() => handleTabChange('settings')}
          >
            {mazeScreenText.tabs.settings}
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
          {activeTab === 'settings' ? (
            <>
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
              <button
                className="app__button app__button--secondary"
                onClick={handleApplyDimensions}
              >
                {mazeScreenText.buttons.applySize}
              </button>
            </>
          ) : activeTab === 'edit' ? (
            <>
              <p className="app__status">{mazeScreenText.edit.hint}</p>
              <div className="app__tabs app__tabs--edit" role="tablist" aria-label="Edit modes">
                <button
                  className={`app__tab ${editMode === 'wall' ? 'app__tab--active' : ''}`}
                  type="button"
                  onClick={() => setEditMode('wall')}
                >
                  {mazeScreenText.edit.modes.wall}
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
              <button
                className="app__button app__button--secondary"
                onClick={handleApplyDimensions}
              >
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
          ) : activeTab === 'search' ? (
            <>
              <div className="app__field">
                <span className="app__fieldLabel">
                  {mazeScreenText.search.algorithmLabel}
                </span>
                <div
                  className="app__tabs app__tabs--search"
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
              <p className="app__status">{mazeScreenText.search.hint}</p>
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
              <button
                className="app__button app__button--secondary"
                onClick={handleSearchReset}
              >
                {mazeScreenText.buttons.reset}
              </button>
            </>
          ) : activeTab === 'play' ? (
            <>
              <div className="app__field">
                <span className="app__fieldLabel">{mazeScreenText.play.wallLabel}</span>
                <div className="app__tabs app__tabs--search" role="tablist" aria-label="Play wall settings">
                  <button
                    className={`app__tab ${showWallsInPlay ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => setShowWallsInPlay(true)}
                  >
                    {mazeScreenText.play.wallVisible}
                  </button>
                  <button
                    className={`app__tab ${!showWallsInPlay ? 'app__tab--active' : ''}`}
                    type="button"
                    onClick={() => setShowWallsInPlay(false)}
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
              <p className="app__status">
                {mazeScreenText.play.steps}: {playerState.stepCount}
                {playerState.isSolved ? ` / ${mazeScreenText.play.solved}` : ''}
              </p>
              <button
                className="app__button"
                onClick={handlePlayGenerate}
              >
                {mazeScreenText.play.generate}
              </button>
              <button
                className="app__button app__button--secondary"
                onClick={handlePlayReset}
              >
                {mazeScreenText.buttons.reset}
              </button>
            </>
          ) : (
            <>
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
          )}
        </section>
      </aside>
    </main>
  )
}

export default MazeScreen
