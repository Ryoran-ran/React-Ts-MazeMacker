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

type CellPosition = {
  x: number
  y: number
}

type MazeCanvasProps = {
  maze: MazeData
  cellSize?: number
  wallColor?: string
  backgroundColor?: string
  currentCell?: CellPosition | null
  visited?: boolean[][]
}

const GRID_SIZE = 20

function MazeCanvas({
  maze,
  cellSize = 24,
  wallColor = '#111827',
  backgroundColor = '#ffffff',
  currentCell = null,
  visited,
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

        for (let y = 0; y < GRID_SIZE; y += 1) {
          for (let x = 0; x < GRID_SIZE; x += 1) {
            const cell = maze[y][x]
            const drawX = x * cellSize
            const drawY = y * cellSize

            if (visited?.[y]?.[x]) {
              p.noStroke()
              p.fill('#dbeafe')
              p.rect(drawX, drawY, cellSize, cellSize)
            }

            if (currentCell?.x === x && currentCell?.y === y) {
              p.noStroke()
              p.fill('#f59e0b')
              p.rect(drawX, drawY, cellSize, cellSize)
            }

            p.stroke(wallColor)
            p.strokeWeight(2)
            p.noFill()

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
  }, [backgroundColor, cellSize, currentCell, maze, visited, wallColor])

  return <div ref={containerRef} />
}

export default MazeCanvas
