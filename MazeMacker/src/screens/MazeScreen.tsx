import { useEffect, useState } from 'react'
import MazeCanvas from '../components/MazeCanvas'
import {
  completeMazeGeneration,
  createMazeGenerationState,
  stepMazeGeneration,
} from '../data/mazeGenerator'

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
      <div className="app__header">
        <p className="app__eyebrow">React + TypeScript + p5.js</p>
        <h1>Maze Renderer</h1>
        <p className="app__description">
          ボタンを押すたびに 1 ステップずつ迷路生成を進めます。
        </p>
      </div>

      <section className="app__controls">
        <button
          className="app__button"
          onClick={handleStep}
          disabled={generationState.isComplete || isPlaying}
        >
          1フレーム進める
        </button>
        <button
          className="app__button"
          onClick={handlePlayToggle}
          disabled={generationState.isComplete}
        >
          {isPlaying ? '停止' : '自動再生'}
        </button>
        <button
          className="app__button"
          onClick={handleComplete}
          disabled={generationState.isComplete}
        >
          最後まで作成
        </button>
        <button className="app__button app__button--secondary" onClick={handleReset}>
          リセット
        </button>
        <p className="app__status">
          steps: {generationState.stepCount}
          {isPlaying ? ' / playing' : ''}
          {generationState.isComplete ? ' / completed' : ''}
        </p>
      </section>

      <section className="app__panel">
        <MazeCanvas
          maze={generationState.maze}
          visited={generationState.visited}
          currentCell={generationState.currentCell}
          cellSize={24}
        />
      </section>
    </main>
  )
}

export default MazeScreen
