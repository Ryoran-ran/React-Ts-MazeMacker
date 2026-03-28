import MazeCanvas from '../components/MazeCanvas'
import { sampleMaze } from '../data/sampleMaze'

function MazeScreen() {
  return (
    <main className="app">
      <div className="app__header">
        <p className="app__eyebrow">React + TypeScript + p5.js</p>
        <h1>Maze Renderer</h1>
        <p className="app__description">
          `maze` props で受け取った 20x20 のセル配列を p5.js で描画します。
        </p>
      </div>

      <section className="app__panel">
        <MazeCanvas maze={sampleMaze} cellSize={24} />
      </section>
    </main>
  )
}

export default MazeScreen
