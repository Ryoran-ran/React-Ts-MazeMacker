import { useEffect, useState } from 'react'
import MazeCanvas from '../components/MazeCanvas'
import {
  completeMazeGeneration,
  createMazeGenerationState,
  stepMazeGeneration,
} from '../data/mazeGenerator'
import mazeScreenText from '../text/mazeScreen.json'

const PLAY_INTERVAL_MS = 40

function MazeScreen() {
  const [generationState, setGenerationState] = useState(() =>
    createMazeGenerationState(),
  )
  const [isPlaying, setIsPlaying] = useState(false)

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

  function handleReset() {
    setIsPlaying(false)
    setGenerationState(createMazeGenerationState())
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
        <div className="app__header">
          <p className="app__description">{mazeScreenText.description}</p>
        </div>

        <section className="app__controls">
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
          <p className="app__status">
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
