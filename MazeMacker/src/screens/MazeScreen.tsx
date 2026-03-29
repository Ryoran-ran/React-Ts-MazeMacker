import { useEffect, useState } from 'react'
import MazeCanvas, {
  type MazeEditMode,
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
  type MazeSearchAlgorithm,
} from '../data/mazeSearch'
import mazeScreenText from '../text/mazeScreen.json'

const PLAY_INTERVAL_MS = 40
const MIN_DIMENSION = 2
type SidebarTab = 'controls' | 'settings' | 'edit' | 'search'

function normalizeDimension(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) {
    return fallback
  }

  return Math.max(MIN_DIMENSION, parsed)
}

function MazeScreen() {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<MazeAlgorithm>('digging')
  const [selectedSearchAlgorithm, setSelectedSearchAlgorithm] =
    useState<MazeSearchAlgorithm>('bfs')
  const [generationState, setGenerationState] = useState(() =>
    createMazeGenerationState(DEFAULT_MAZE_DIMENSIONS, 'digging'),
  )
  const [searchState, setSearchState] = useState(() =>
    createMazeSearchState(
      createMazeGenerationState(DEFAULT_MAZE_DIMENSIONS, 'digging').maze,
      'bfs',
    ),
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSearchPlaying, setIsSearchPlaying] = useState(false)
  const [activeTab, setActiveTab] = useState<SidebarTab>('controls')
  const [editMode, setEditMode] = useState<MazeEditMode>('wall')
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
    if (!isSearchPlaying || searchState.isComplete) {
      return
    }

    const timerId = window.setInterval(() => {
      setSearchState((currentState) => stepMazeSearch(currentState))
    }, PLAY_INTERVAL_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [isSearchPlaying, searchState.isComplete])

  useEffect(() => {
    if (generationState.isComplete) {
      setIsPlaying(false)
    }
  }, [generationState.isComplete])

  useEffect(() => {
    if (searchState.isComplete) {
      setIsSearchPlaying(false)
    }
  }, [searchState.isComplete])

  useEffect(() => {
    setIsSearchPlaying(false)
    setSearchState(createMazeSearchState(generationState.maze, selectedSearchAlgorithm))
  }, [generationState.maze, selectedSearchAlgorithm])

  function handleStep() {
    setGenerationState((currentState) => stepMazeGeneration(currentState))
  }

  function handlePlayToggle() {
    setIsPlaying((currentState) => !currentState)
  }

  function handleSearchStep() {
    setSearchState((currentState) => stepMazeSearch(currentState))
  }

  function handleSearchPlayToggle() {
    setIsSearchPlaying((currentState) => !currentState)
  }

  function handleTabChange(nextTab: SidebarTab) {
    if (nextTab === 'edit' || nextTab === 'search') {
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
    setSearchState((currentState) => completeMazeSearch(currentState))
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
    setSearchState(createMazeSearchState(generationState.maze, selectedSearchAlgorithm))
  }

  function handleAlgorithmChange(nextAlgorithm: MazeAlgorithm) {
    const nextDimensions = buildDimensionsFromInputs()

    setIsPlaying(false)
    setSelectedAlgorithm(nextAlgorithm)
    setGenerationState(createMazeGenerationState(nextDimensions, nextAlgorithm))
  }

  function handleSearchAlgorithmChange(nextAlgorithm: MazeSearchAlgorithm) {
    setIsSearchPlaying(false)
    setSelectedSearchAlgorithm(nextAlgorithm)
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
        <MazeCanvas
          maze={generationState.maze}
          path={activeTab === 'search' ? searchState.path : undefined}
          visited={
            activeTab === 'search'
              ? searchState.visited
              : generationState.algorithm === 'wallFilling'
                ? undefined
                : generationState.visited
          }
          currentCell={
            activeTab === 'search'
              ? searchState.isComplete || searchState.stepCount === 0
                ? null
                : searchState.currentCell
              : generationState.isComplete || generationState.stepCount === 0
                ? null
                : generationState.currentCell
          }
          currentCellSpan={
            activeTab !== 'search' &&
            (selectedAlgorithm === 'stickFalling' || selectedAlgorithm === 'wallExtending')
              ? { columns: 2, rows: 2 }
              : { columns: 1, rows: 1 }
          }
          cellSize={24}
          editable={activeTab === 'edit'}
          editMode={editMode}
          onCellSelect={handleCellSelect}
          onWallToggle={handleWallToggle}
        />
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
              <label className="app__field">
                <span className="app__fieldLabel">
                  {mazeScreenText.search.algorithmLabel}
                </span>
                <select
                  className="app__input"
                  value={selectedSearchAlgorithm}
                  onChange={(event) =>
                    handleSearchAlgorithmChange(event.target.value as MazeSearchAlgorithm)
                  }
                >
                  {MAZE_SEARCH_ALGORITHM_OPTIONS.map((algorithm) => (
                    <option key={algorithm.value} value={algorithm.value}>
                      {algorithm.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="app__status">{mazeScreenText.search.hint}</p>
              <button
                className="app__button"
                onClick={handleSearchStep}
                disabled={searchState.isComplete || isSearchPlaying}
              >
                {mazeScreenText.buttons.step}
              </button>
              <button
                className="app__button"
                onClick={handleSearchPlayToggle}
                disabled={searchState.isComplete}
              >
                {isSearchPlaying ? mazeScreenText.buttons.stop : mazeScreenText.buttons.play}
              </button>
              <button
                className="app__button"
                onClick={handleSearchComplete}
                disabled={searchState.isComplete}
              >
                {mazeScreenText.buttons.complete}
              </button>
              <button
                className="app__button app__button--secondary"
                onClick={handleSearchReset}
              >
                {mazeScreenText.buttons.reset}
              </button>
              <p className="app__status">
                {mazeScreenText.search.status.algorithm}:{' '}
                {mazeScreenText.search.options[selectedSearchAlgorithm]}
                <br />
                {mazeScreenText.search.status.steps}: {searchState.stepCount}
                {isSearchPlaying ? ` / ${mazeScreenText.status.playing}` : ''}
                {searchState.isSolved ? ` / ${mazeScreenText.search.status.solved}` : ''}
                {searchState.isComplete ? ` / ${mazeScreenText.status.completed}` : ''}
              </p>
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
