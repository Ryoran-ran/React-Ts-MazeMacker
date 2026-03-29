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
export type MazeWallDirection = 'top' | 'right' | 'bottom' | 'left'
export type MazeEditMode = 'goal' | 'start' | 'wall'

type CellPosition = {
  x: number
  y: number
}

type CellSpan = {
  columns: number
  rows: number
}

type RevealedWall = {
  direction: MazeWallDirection
  x: number
  y: number
}

type MazeCanvasProps = {
  maze: MazeData
  cellSize?: number
  showWalls?: boolean
  wallColor?: string
  backgroundColor?: string
  currentCell?: CellPosition | null
  currentCellSpan?: CellSpan
  path?: boolean[][]
  openSet?: boolean[][]
  revealedWalls?: RevealedWall[]
  visited?: boolean[][]
  editable?: boolean
  editMode?: MazeEditMode
  onCellSelect?: (position: CellPosition) => void
  onWallToggle?: (position: CellPosition, direction: MazeWallDirection) => void
}

function MazeCanvas({
  maze,
  cellSize = 24,
  showWalls = true,
  wallColor = '#111827',
  backgroundColor = '#ffffff',
  currentCell = null,
  currentCellSpan = { columns: 1, rows: 1 },
  path,
  openSet,
  revealedWalls = [],
  visited,
  editable = false,
  editMode = 'wall',
  onCellSelect,
  onWallToggle,
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

      p.mousePressed = () => {
        if (!editable) {
          return
        }

        const clickX = p.mouseX
        const clickY = p.mouseY

        if (clickX < 0 || clickX >= canvasWidth || clickY < 0 || clickY >= canvasHeight) {
          return
        }

        const cellX = Math.min(columnCount - 1, Math.floor(clickX / responsiveCellSize))
        const cellY = Math.min(rowCount - 1, Math.floor(clickY / responsiveCellSize))

        if (editMode === 'start' || editMode === 'goal') {
          onCellSelect?.({ x: cellX, y: cellY })
          return
        }

        if (!onWallToggle) {
          return
        }

        const localX = clickX - cellX * responsiveCellSize
        const localY = clickY - cellY * responsiveCellSize
        const distances: Array<{ direction: MazeWallDirection; distance: number }> = [
          { direction: 'top', distance: localY },
          { direction: 'right', distance: responsiveCellSize - localX },
          { direction: 'bottom', distance: responsiveCellSize - localY },
          { direction: 'left', distance: localX },
        ]

        distances.sort((left, right) => left.distance - right.distance)
        onWallToggle({ x: cellX, y: cellY }, distances[0].direction)
      }

      p.draw = () => {
        p.background(backgroundColor)

        const revealedWallSet = new Set(
          revealedWalls.map((wall) => `${wall.x}:${wall.y}:${wall.direction}`),
        )

        function shouldDrawWall(x: number, y: number, direction: MazeWallDirection) {
          return showWalls || revealedWallSet.has(`${x}:${y}:${direction}`)
        }

        for (let y = 0; y < rowCount; y += 1) {
          for (let x = 0; x < columnCount; x += 1) {
            const cell = maze[y][x]
            const drawX = x * responsiveCellSize
            const drawY = y * responsiveCellSize

            if (openSet?.[y]?.[x]) {
              p.noStroke()
              p.fill('#fde68a')
              p.rect(drawX, drawY, responsiveCellSize, responsiveCellSize)
            }

            if (visited?.[y]?.[x]) {
              p.noStroke()
              p.fill('#dbeafe')
              p.rect(drawX, drawY, responsiveCellSize, responsiveCellSize)
            }

            if (path?.[y]?.[x]) {
              p.noStroke()
              p.fill('#86efac')
              p.rect(drawX, drawY, responsiveCellSize, responsiveCellSize)
            }

            const isCurrentCellHighlighted =
              currentCell !== null &&
              x >= currentCell.x &&
              x < Math.min(columnCount, currentCell.x + currentCellSpan.columns) &&
              y >= currentCell.y &&
              y < Math.min(rowCount, currentCell.y + currentCellSpan.rows)

            if (isCurrentCellHighlighted) {
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
              const textYOffset = responsiveCellSize * 0.06
              p.text(
                cell.kind === 'start' ? 'S' : 'G',
                drawX + responsiveCellSize / 2,
                drawY + responsiveCellSize / 2 + textYOffset,
              )
            }

            p.stroke(wallColor)
            p.strokeWeight(2)
            p.noFill()

            if (cell.walls.top && shouldDrawWall(x, y, 'top')) {
              p.line(drawX, drawY, drawX + responsiveCellSize, drawY)
            }
            if (cell.walls.right && shouldDrawWall(x, y, 'right')) {
              p.line(
                drawX + responsiveCellSize,
                drawY,
                drawX + responsiveCellSize,
                drawY + responsiveCellSize,
              )
            }
            if (cell.walls.bottom && shouldDrawWall(x, y, 'bottom')) {
              p.line(
                drawX,
                drawY + responsiveCellSize,
                drawX + responsiveCellSize,
                drawY + responsiveCellSize,
              )
            }
            if (cell.walls.left && shouldDrawWall(x, y, 'left')) {
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
    currentCellSpan.columns,
    currentCellSpan.rows,
    editMode,
    editable,
    maze,
    onCellSelect,
    onWallToggle,
    openSet,
    path,
    revealedWalls,
    rowCount,
    showWalls,
    visited,
    wallColor,
  ])

  return (
    <div
      ref={containerRef}
      className={`maze-canvas ${editable ? 'maze-canvas--editable' : ''}`}
    />
  )
}

export default MazeCanvas
