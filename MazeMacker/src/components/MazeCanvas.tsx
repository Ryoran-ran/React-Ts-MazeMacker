import { useEffect, useRef, useState } from 'react'
import p5 from 'p5'

export type MazeCellWalls = {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

export type MazeCell = {
  kind?: 'goal' | 'start'
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
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const rowCount = maze.length
  const columnCount = maze[0]?.length ?? 0

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerSize({
        width,
        height,
      })
    })

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (rowCount === 0 || columnCount === 0) {
      throw new Error('maze must contain at least one cell')
    }

    if (maze.some((row) => row.length !== columnCount)) {
      throw new Error('maze rows must all have the same length')
    }

    if (!containerRef.current || containerSize.width === 0 || containerSize.height === 0) {
      return
    }

    instanceRef.current?.remove()

    const sketch = (p: p5) => {
      const responsiveCellSize = Math.max(
        4,
        Math.floor(
          Math.min(
            cellSize,
            containerSize.width / columnCount,
            containerSize.height / rowCount,
          ),
        ),
      )
      const canvasWidth = responsiveCellSize * columnCount
      const canvasHeight = responsiveCellSize * rowCount
      const outerBorderWeight = 2

      p.setup = () => {
        p.createCanvas(canvasWidth, canvasHeight)
        p.noLoop()
      }

      p.draw = () => {
        p.background(backgroundColor)

        for (let y = 0; y < rowCount; y += 1) {
          for (let x = 0; x < columnCount; x += 1) {
            const cell = maze[y][x]
            const drawX = x * responsiveCellSize
            const drawY = y * responsiveCellSize

            if (visited?.[y]?.[x]) {
              p.noStroke()
              p.fill('#dbeafe')
              p.rect(drawX, drawY, responsiveCellSize, responsiveCellSize)
            }

            if (currentCell?.x === x && currentCell?.y === y) {
              p.noStroke()
              p.fill('#f59e0b')
              p.rect(drawX, drawY, responsiveCellSize, responsiveCellSize)
            }

            if (cell.kind === 'start' || cell.kind === 'goal') {
              p.noStroke()
              p.fill(cell.kind === 'start' ? '#2563eb' : '#dc2626')
              p.rect(drawX, drawY, responsiveCellSize, responsiveCellSize)
              p.fill('#ffffff')
              p.textAlign(p.CENTER, p.CENTER)
              p.textSize(Math.max(12, responsiveCellSize * 0.55))
              p.textStyle(p.BOLD)
              p.text(
                cell.kind === 'start' ? 'S' : 'G',
                drawX + responsiveCellSize / 2,
                drawY + responsiveCellSize / 2,
              )
            }

            p.stroke(wallColor)
            p.strokeWeight(2)
            p.noFill()

            if (cell.walls.top) {
              p.line(drawX, drawY, drawX + responsiveCellSize, drawY)
            }
            if (cell.walls.right) {
              p.line(
                drawX + responsiveCellSize,
                drawY,
                drawX + responsiveCellSize,
                drawY + responsiveCellSize,
              )
            }
            if (cell.walls.bottom) {
              p.line(
                drawX,
                drawY + responsiveCellSize,
                drawX + responsiveCellSize,
                drawY + responsiveCellSize,
              )
            }
            if (cell.walls.left) {
              p.line(drawX, drawY, drawX, drawY + responsiveCellSize)
            }
          }
        }

        p.stroke(wallColor)
        p.strokeWeight(outerBorderWeight)
        p.noFill()
        p.rect(
          outerBorderWeight / 2,
          outerBorderWeight / 2,
          canvasWidth - outerBorderWeight,
          canvasHeight - outerBorderWeight,
        )
      }
    }

    instanceRef.current = new p5(sketch, containerRef.current)

    return () => {
      instanceRef.current?.remove()
      instanceRef.current = null
    }
  }, [
    backgroundColor,
    cellSize,
    columnCount,
    containerSize.height,
    containerSize.width,
    currentCell,
    maze,
    rowCount,
    visited,
    wallColor,
  ])

  return <div ref={containerRef} className="maze-canvas" />
}

export default MazeCanvas
