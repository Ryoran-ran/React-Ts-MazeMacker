import { useEffect, useState } from 'react'
import MazeCanvas from '../components/MazeCanvas'
import {
  DEFAULT_MAZE_DIMENSIONS,
  type MazeDimensions,
  completeMazeGeneration,
  createMazeGenerationState,
  stepMazeGeneration,
} from '../data/mazeGenerator'
import mazeScreenText from '../text/mazeScreen.json'

const PLAY_INTERVAL_MS = 40
const MIN_DIMENSION = 2
type SidebarTab = 'controls' | 'settings'

function normalizeDimension(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) {
    return fallback
  }

  return Math.max(MIN_DIMENSION, parsed)
}

function MazeScreen() {
  const [generationState, setGenerationState] = useState(() =>
    createMazeGenerationState(DEFAULT_MAZE_DIMENSIONS),
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeTab, setActiveTab] = useState<SidebarTab>('controls')
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
    if (generationState.isComplete) {
      setIsPlaying(false)
    }
  }, [generationState.isComplete])

  function handleStep() {
    setGenerationState((currentState) => stepMazeGeneration(currentState))
  }

  function handlePlayToggle() {
    setIsPlaying((currentState) => !currentState)
  }

  function handleComplete() {
    setIsPlaying(false)
    setGenerationState((currentState) => completeMazeGeneration(currentState))
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
    setGenerationState(createMazeGenerationState(nextDimensions))
  }

  function handleReset() {
    const nextDimensions = buildDimensionsFromInputs()

    setIsPlaying(false)
    setDimensionInputs({
      columns: String(nextDimensions.columns),
      rows: String(nextDimensions.rows),
    })
    setGenerationState(createMazeGenerationState(nextDimensions))
  }

  return (
    <main className="app">
      <header className="app__topbar">
        <h1>{mazeScreenText.title}</h1>
      </header>

      <section className="app__panel">
        <MazeCanvas
          maze={generationState.maze}
          visited={generationState.visited}
          currentCell={generationState.currentCell}
          cellSize={24}
        />
      </section>

      <aside className="app__sidebar">
        <div className="app__tabs" role="tablist" aria-label="Sidebar tabs">
          <button
            className={`app__tab ${activeTab === 'controls' ? 'app__tab--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'controls'}
            onClick={() => setActiveTab('controls')}
          >
            {mazeScreenText.tabs.controls}
          </button>
          <button
            className={`app__tab ${activeTab === 'settings' ? 'app__tab--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          >
            {mazeScreenText.tabs.settings}
          </button>
        </div>

        <section className="app__controls">
          {activeTab === 'settings' ? (
            <>
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
          <p className="app__status">
            {mazeScreenText.status.dimensions}: {generationState.dimensions.columns} x{' '}
            {generationState.dimensions.rows}
            <br />
            {mazeScreenText.status.steps}: {generationState.stepCount}
            {isPlaying ? ` / ${mazeScreenText.status.playing}` : ''}
            {generationState.isComplete ? ` / ${mazeScreenText.status.completed}` : ''}
          </p>
        </section>
      </aside>
    </main>
  )
}

export default MazeScreen
