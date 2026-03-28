import { useEffect, useRef } from 'react'
import p5 from 'p5'

export type MazeCellWalls = {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

export type MazeCell = {
  walls: MazeCellWalls
}

export type MazeData = MazeCell[][]

type MazeCanvasProps = {
  maze: MazeData
  cellSize?: number
  wallColor?: string
  backgroundColor?: string
}

const GRID_SIZE = 20

function MazeCanvas({
  maze,
  cellSize = 24,
  wallColor = '#111827',
  backgroundColor = '#ffffff',
}: MazeCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<p5 | null>(null)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    if (maze.length !== GRID_SIZE || maze.some((row) => row.length !== GRID_SIZE)) {
      throw new Error(`maze must be a ${GRID_SIZE}x${GRID_SIZE} grid`)
    }

    instanceRef.current?.remove()

    const sketch = (p: p5) => {
      const canvasSize = GRID_SIZE * cellSize

      p.setup = () => {
        p.createCanvas(canvasSize, canvasSize)
        p.noLoop()
      }

      p.draw = () => {
        p.background(backgroundColor)
        p.stroke(wallColor)
        p.strokeWeight(2)

        for (let y = 0; y < GRID_SIZE; y += 1) {
          for (let x = 0; x < GRID_SIZE; x += 1) {
            const cell = maze[y][x]
            const drawX = x * cellSize
            const drawY = y * cellSize

            if (cell.walls.top) {
              p.line(drawX, drawY, drawX + cellSize, drawY)
            }
            if (cell.walls.right) {
              p.line(drawX + cellSize, drawY, drawX + cellSize, drawY + cellSize)
            }
            if (cell.walls.bottom) {
              p.line(drawX, drawY + cellSize, drawX + cellSize, drawY + cellSize)
            }
            if (cell.walls.left) {
              p.line(drawX, drawY, drawX, drawY + cellSize)
            }
          }
        }
      }
    }

    instanceRef.current = new p5(sketch, containerRef.current)

    return () => {
      instanceRef.current?.remove()
      instanceRef.current = null
    }
  }, [backgroundColor, cellSize, maze, wallColor])

  return <div ref={containerRef} />
}

export default MazeCanvas
