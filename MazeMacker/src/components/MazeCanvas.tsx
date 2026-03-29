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

type BumpState = {
  direction: MazeWallDirection
  tick: number
}

type MazeCanvasProps = {
  maze: MazeData
  cellSize?: number
  bumpState?: BumpState | null
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
  bumpState = null,
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
  const stageRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<p5 | null>(null)
  const bumpAnimationRef = useRef<number | null>(null)
  const bumpDirectionRef = useRef<MazeWallDirection | null>(null)
  const bumpProgressRef = useRef(0)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const rowCount = maze.length
  const columnCount = maze[0]?.length ?? 0

  useEffect(() => {
    return () => {
      if (bumpAnimationRef.current !== null) {
        window.cancelAnimationFrame(bumpAnimationRef.current)
      }
    }
  }, [])

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

    if (
      !containerRef.current ||
      !stageRef.current ||
      containerSize.width === 0 ||
      containerSize.height === 0
    ) {
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
              const horizontalBump =
                bumpDirectionRef.current === 'left' || bumpDirectionRef.current === 'right'
              const stretch = bumpProgressRef.current * responsiveCellSize * 0.18
              const currentWidth = horizontalBump
                ? responsiveCellSize - stretch
                : responsiveCellSize + stretch * 0.75
              const currentHeight = horizontalBump
                ? responsiveCellSize + stretch * 0.75
                : responsiveCellSize - stretch
              const currentOffsetX = -(currentWidth - responsiveCellSize) / 2
              const currentOffsetY = -(currentHeight - responsiveCellSize) / 2

              p.rect(
                drawX + currentOffsetX,
                drawY + currentOffsetY,
                currentWidth,
                currentHeight,
              )
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

    instanceRef.current = new p5(sketch, stageRef.current)

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

  useEffect(() => {
    if (!bumpState) {
      return
    }

    if (bumpAnimationRef.current !== null) {
      window.cancelAnimationFrame(bumpAnimationRef.current)
    }

    const durationMs = 140
    const startTime = performance.now()
    bumpDirectionRef.current = bumpState.direction

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(1, elapsed / durationMs)
      bumpProgressRef.current = Math.sin(progress * Math.PI)
      instanceRef.current?.redraw()

      if (progress < 1) {
        bumpAnimationRef.current = window.requestAnimationFrame(animate)
        return
      }

      bumpProgressRef.current = 0
      bumpDirectionRef.current = null
      instanceRef.current?.redraw()
      bumpAnimationRef.current = null
    }

    bumpAnimationRef.current = window.requestAnimationFrame(animate)
  }, [bumpState])

  return (
    <div
      ref={containerRef}
      className={`maze-canvas ${editable ? 'maze-canvas--editable' : ''}`}
    >
      <div
        ref={stageRef}
        className="maze-canvas__stage"
      />
    </div>
  )
}

export default MazeCanvas
