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
export type MazeDisplayMode = 'graph' | 'maze'
type PlayHandGuideMode = 'hidden' | 'left' | 'right'
type PlayWallVisibilityMode = 'all' | 'hidden' | 'nearby'

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
  displayMode?: MazeDisplayMode
  showGraphEdgeCosts?: boolean
  bumpState?: BumpState | null
  celebrateGoal?: boolean
  currentFacingDirection?: MazeWallDirection | null
  playWallVisibilityMode?: PlayWallVisibilityMode
  showVisitedWalls?: boolean
  playHandGuideMode?: PlayHandGuideMode
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
  displayMode = 'maze',
  showGraphEdgeCosts = false,
  bumpState = null,
  celebrateGoal = false,
  currentFacingDirection = null,
  playWallVisibilityMode = 'all',
  showVisitedWalls = false,
  playHandGuideMode = 'hidden',
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
  const celebrationAnimationRef = useRef<number | null>(null)
  const bumpDirectionRef = useRef<MazeWallDirection | null>(null)
  const bumpProgressRef = useRef(0)
  const celebrationProgressRef = useRef(0)
  const hoverTargetRef = useRef<{
    direction: MazeWallDirection | null
    x: number
    y: number
  } | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const rowCount = maze.length
  const columnCount = maze[0]?.length ?? 0

  useEffect(() => {
    return () => {
      if (bumpAnimationRef.current !== null) {
        window.cancelAnimationFrame(bumpAnimationRef.current)
      }
      if (celebrationAnimationRef.current !== null) {
        window.cancelAnimationFrame(celebrationAnimationRef.current)
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
    stageRef.current.replaceChildren()

    const sketch = (p: p5) => {
      function getHandDirection(
        facingDirection: MazeWallDirection,
        handGuideMode: PlayHandGuideMode,
      ): MazeWallDirection {
        if (handGuideMode === 'right') {
          if (facingDirection === 'top') {
            return 'right'
          }
          if (facingDirection === 'right') {
            return 'bottom'
          }
          if (facingDirection === 'bottom') {
            return 'left'
          }

          return 'top'
        }

        if (facingDirection === 'top') {
          return 'left'
        }
        if (facingDirection === 'right') {
          return 'top'
        }
        if (facingDirection === 'bottom') {
          return 'right'
        }

        return 'bottom'
      }

      function getDirectionMarkerPosition(
        drawX: number,
        drawY: number,
        responsiveCellSize: number,
        direction: MazeWallDirection,
      ) {
        const markerInset = responsiveCellSize * 0.22
        let markerX = drawX + responsiveCellSize / 2
        let markerY = drawY + responsiveCellSize / 2

        if (direction === 'top') {
          markerY = drawY + markerInset
        } else if (direction === 'right') {
          markerX = drawX + responsiveCellSize - markerInset
        } else if (direction === 'bottom') {
          markerY = drawY + responsiveCellSize - markerInset
        } else {
          markerX = drawX + markerInset
        }

        return { markerX, markerY }
      }

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

      function resolveEditTarget(pointerX: number, pointerY: number) {
        if (!editable) {
          return null
        }

        if (pointerX < 0 || pointerX >= canvasWidth || pointerY < 0 || pointerY >= canvasHeight) {
          return null
        }

        const cellX = Math.min(columnCount - 1, Math.floor(pointerX / responsiveCellSize))
        const cellY = Math.min(rowCount - 1, Math.floor(pointerY / responsiveCellSize))

        if (editMode === 'start' || editMode === 'goal') {
          return { x: cellX, y: cellY, direction: null as MazeWallDirection | null }
        }

        const localX = pointerX - cellX * responsiveCellSize
        const localY = pointerY - cellY * responsiveCellSize
        const distances: Array<{ direction: MazeWallDirection; distance: number }> = [
          { direction: 'top', distance: localY },
          { direction: 'right', distance: responsiveCellSize - localX },
          { direction: 'bottom', distance: responsiveCellSize - localY },
          { direction: 'left', distance: localX },
        ]

        distances.sort((left, right) => left.distance - right.distance)

        return {
          x: cellX,
          y: cellY,
          direction: distances[0].direction,
        }
      }

      p.mouseMoved = () => {
        if (editable) {
          hoverTargetRef.current = resolveEditTarget(p.mouseX, p.mouseY)
          p.redraw()
        }
      }

      p.mouseReleased = () => {
        if (editable) {
          hoverTargetRef.current = resolveEditTarget(p.mouseX, p.mouseY)
          p.redraw()
        }
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
        const hoveredEditTarget = hoverTargetRef.current
        const isGraphMode = displayMode === 'graph'

        const revealedWallSet = new Set(
          revealedWalls.map((wall) => `${wall.x}:${wall.y}:${wall.direction}`),
        )

        function hasVisitedWallNeighbor(x: number, y: number, direction: MazeWallDirection) {
          if (!showVisitedWalls || !visited) {
            return false
          }

          if (visited[y]?.[x]) {
            return true
          }

          if (direction === 'top') {
            return y > 0 && Boolean(visited[y - 1]?.[x])
          }
          if (direction === 'right') {
            return x < columnCount - 1 && Boolean(visited[y]?.[x + 1])
          }
          if (direction === 'bottom') {
            return y < rowCount - 1 && Boolean(visited[y + 1]?.[x])
          }

          return x > 0 && Boolean(visited[y]?.[x - 1])
        }

        function hasCurrentCellNeighbor(x: number, y: number, direction: MazeWallDirection) {
          if (playWallVisibilityMode !== 'nearby' || currentCell === null) {
            return false
          }

          const isAroundCurrent = (cellX: number, cellY: number) =>
            cellX >= currentCell.x - 1 &&
            cellX <= currentCell.x + currentCellSpan.columns &&
            cellY >= currentCell.y - 1 &&
            cellY <= currentCell.y + currentCellSpan.rows

          if (isAroundCurrent(x, y)) {
            return true
          }

          if (direction === 'top') {
            return y > 0 && isAroundCurrent(x, y - 1)
          }
          if (direction === 'right') {
            return x < columnCount - 1 && isAroundCurrent(x + 1, y)
          }
          if (direction === 'bottom') {
            return y < rowCount - 1 && isAroundCurrent(x, y + 1)
          }

          return x > 0 && isAroundCurrent(x - 1, y)
        }

        function shouldDrawWall(x: number, y: number, direction: MazeWallDirection) {
          return (
            playWallVisibilityMode === 'all' ||
            revealedWallSet.has(`${x}:${y}:${direction}`) ||
            hasVisitedWallNeighbor(x, y, direction) ||
            hasCurrentCellNeighbor(x, y, direction)
          )
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

            if (
              hoveredEditTarget &&
              hoveredEditTarget.x === x &&
              hoveredEditTarget.y === y
            ) {
              if (editMode === 'start' || editMode === 'goal') {
                p.noStroke()
                if (editMode === 'start') {
                  p.fill(37, 99, 235, 52)
                } else {
                  p.fill(220, 38, 38, 52)
                }
                p.rect(drawX, drawY, responsiveCellSize, responsiveCellSize)
              }

              if (hoveredEditTarget.direction) {
                if (displayMode === 'maze') {
                  p.stroke(15, 23, 42, 90)
                  p.strokeWeight(Math.max(4, responsiveCellSize * 0.14))

                  if (editMode === 'wall') {
                    p.stroke(15, 23, 42, 120)
                  }

                  if (hoveredEditTarget.direction === 'top') {
                    p.line(drawX, drawY, drawX + responsiveCellSize, drawY)
                  } else if (hoveredEditTarget.direction === 'right') {
                    p.line(
                      drawX + responsiveCellSize,
                      drawY,
                      drawX + responsiveCellSize,
                      drawY + responsiveCellSize,
                    )
                  } else if (hoveredEditTarget.direction === 'bottom') {
                    p.line(
                      drawX,
                      drawY + responsiveCellSize,
                      drawX + responsiveCellSize,
                      drawY + responsiveCellSize,
                    )
                  } else {
                    p.line(drawX, drawY, drawX, drawY + responsiveCellSize)
                  }
                } else {
                  const centerX = drawX + responsiveCellSize / 2
                  const centerY = drawY + responsiveCellSize / 2
                  let targetX = centerX
                  let targetY = centerY

                  if (hoveredEditTarget.direction === 'top') {
                    targetY -= responsiveCellSize
                  } else if (hoveredEditTarget.direction === 'right') {
                    targetX += responsiveCellSize
                  } else if (hoveredEditTarget.direction === 'bottom') {
                    targetY += responsiveCellSize
                  } else {
                    targetX -= responsiveCellSize
                  }

                  p.stroke(15, 23, 42, 110)
                  p.strokeWeight(Math.max(5, responsiveCellSize * 0.18))
                  p.strokeCap(p.ROUND)
                  p.line(centerX, centerY, targetX, targetY)

                  p.noStroke()
                  p.fill(15, 23, 42, 72)
                  p.circle(centerX, centerY, Math.max(10, responsiveCellSize * 0.36))
                  p.circle(targetX, targetY, Math.max(10, responsiveCellSize * 0.36))
                }
              }
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

              if (celebrationProgressRef.current > 0) {
                const burstProgress = celebrationProgressRef.current
                const centerX = drawX + responsiveCellSize / 2
                const centerY = drawY + responsiveCellSize / 2
                const ringRadius = responsiveCellSize * (0.34 + burstProgress * 0.78)
                const sparkRadius = responsiveCellSize * (0.44 + burstProgress * 0.92)

                p.noFill()
                p.stroke('#fbbf24')
                p.strokeWeight(
                  Math.max(2, responsiveCellSize * 0.08 * (1 - burstProgress * 0.45)),
                )
                p.circle(centerX, centerY, ringRadius * 2)

                p.noStroke()
                p.fill('#fde68a')

                for (let index = 0; index < 8; index += 1) {
                  const angle = (Math.PI * 2 * index) / 8
                  const sparkX = centerX + Math.cos(angle) * sparkRadius
                  const sparkY = centerY + Math.sin(angle) * sparkRadius
                  const sparkSize = Math.max(
                    4,
                    responsiveCellSize * 0.12 * (1 - burstProgress * 0.3),
                  )
                  p.circle(sparkX, sparkY, sparkSize)
                }
              }

              if (currentFacingDirection) {
                const frontMarker = getDirectionMarkerPosition(
                  drawX,
                  drawY,
                  responsiveCellSize,
                  currentFacingDirection,
                )

                p.noStroke()
                p.fill('#ffffff')
                p.circle(frontMarker.markerX, frontMarker.markerY, Math.max(5, responsiveCellSize * 0.18))
              }

              if (playHandGuideMode !== 'hidden' && currentFacingDirection) {
                const handDirection = getHandDirection(
                  currentFacingDirection,
                  playHandGuideMode,
                )
                const markerDiameter = Math.max(6, responsiveCellSize * 0.24)
                const handMarker = getDirectionMarkerPosition(
                  drawX,
                  drawY,
                  responsiveCellSize,
                  handDirection,
                )

                p.noStroke()
                p.fill(playHandGuideMode === 'right' ? '#dc2626' : '#2563eb')
                p.circle(handMarker.markerX, handMarker.markerY, markerDiameter)
              }
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

            if (!isGraphMode) {
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
        }

        if (path) {
          p.stroke('#16a34a')
          p.strokeWeight(Math.max(3, responsiveCellSize * 0.18))
          p.strokeCap(p.ROUND)

          for (let y = 0; y < rowCount; y += 1) {
            for (let x = 0; x < columnCount; x += 1) {
              if (!path[y]?.[x]) {
                continue
              }

              const centerX = x * responsiveCellSize + responsiveCellSize / 2
              const centerY = y * responsiveCellSize + responsiveCellSize / 2

              if (
                x < columnCount - 1 &&
                path[y]?.[x + 1] &&
                !maze[y][x].walls.right
              ) {
                p.line(centerX, centerY, centerX + responsiveCellSize, centerY)
              }

              if (
                y < rowCount - 1 &&
                path[y + 1]?.[x] &&
                !maze[y][x].walls.bottom
              ) {
                p.line(centerX, centerY, centerX, centerY + responsiveCellSize)
              }
            }
          }
        }

        if (showGraphEdgeCosts) {
          p.textAlign(p.CENTER, p.CENTER)
          p.textStyle(p.BOLD)
          p.textSize(Math.max(8, responsiveCellSize * 0.24))

          for (let y = 0; y < rowCount; y += 1) {
            for (let x = 0; x < columnCount; x += 1) {
              const cell = maze[y][x]
              const centerX = x * responsiveCellSize + responsiveCellSize / 2
              const centerY = y * responsiveCellSize + responsiveCellSize / 2

              if (x < columnCount - 1 && !cell.walls.right) {
                const labelX = centerX + responsiveCellSize / 2
                const labelY = centerY
                p.noStroke()
                p.fill(255, 255, 255, isGraphMode ? 230 : 245)
                p.rect(
                  labelX - responsiveCellSize * 0.14,
                  labelY - responsiveCellSize * 0.14,
                  responsiveCellSize * 0.28,
                  responsiveCellSize * 0.28,
                  responsiveCellSize * 0.08,
                )
                p.fill('#334155')
                p.text('1', labelX, labelY + responsiveCellSize * 0.015)
              }

              if (y < rowCount - 1 && !cell.walls.bottom) {
                const labelX = centerX
                const labelY = centerY + responsiveCellSize / 2
                p.noStroke()
                p.fill(255, 255, 255, isGraphMode ? 230 : 245)
                p.rect(
                  labelX - responsiveCellSize * 0.14,
                  labelY - responsiveCellSize * 0.14,
                  responsiveCellSize * 0.28,
                  responsiveCellSize * 0.28,
                  responsiveCellSize * 0.08,
                )
                p.fill('#334155')
                p.text('1', labelX, labelY + responsiveCellSize * 0.015)
              }
            }
          }
        }

        if (isGraphMode) {
          p.stroke('#94a3b8')
          p.strokeWeight(Math.max(2, responsiveCellSize * 0.1))
          p.strokeCap(p.ROUND)

          for (let y = 0; y < rowCount; y += 1) {
            for (let x = 0; x < columnCount; x += 1) {
              const cell = maze[y][x]
              const centerX = x * responsiveCellSize + responsiveCellSize / 2
              const centerY = y * responsiveCellSize + responsiveCellSize / 2

              if (x < columnCount - 1 && !cell.walls.right) {
                p.line(centerX, centerY, centerX + responsiveCellSize, centerY)
              }

              if (y < rowCount - 1 && !cell.walls.bottom) {
                p.line(centerX, centerY, centerX, centerY + responsiveCellSize)
              }
            }
          }

          p.noStroke()
          p.fill('#334155')

          for (let y = 0; y < rowCount; y += 1) {
            for (let x = 0; x < columnCount; x += 1) {
              const centerX = x * responsiveCellSize + responsiveCellSize / 2
              const centerY = y * responsiveCellSize + responsiveCellSize / 2
              p.circle(centerX, centerY, Math.max(5, responsiveCellSize * 0.22))
            }
          }
        } else {
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
    }

    instanceRef.current = new p5(sketch, stageRef.current)

    return () => {
      instanceRef.current?.remove()
      instanceRef.current = null
      stageRef.current?.replaceChildren()
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
    currentFacingDirection,
    celebrateGoal,
    displayMode,
    editMode,
    editable,
    maze,
    onCellSelect,
    onWallToggle,
    openSet,
    path,
    playWallVisibilityMode,
    playHandGuideMode,
    revealedWalls,
    rowCount,
    showGraphEdgeCosts,
    showVisitedWalls,
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

  useEffect(() => {
    if (!celebrateGoal || currentCell === null) {
      return
    }

    if (celebrationAnimationRef.current !== null) {
      window.cancelAnimationFrame(celebrationAnimationRef.current)
    }

    const durationMs = 520
    const startTime = performance.now()

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(1, elapsed / durationMs)
      celebrationProgressRef.current = Math.sin(progress * Math.PI)
      instanceRef.current?.redraw()

      if (progress < 1) {
        celebrationAnimationRef.current = window.requestAnimationFrame(animate)
        return
      }

      celebrationProgressRef.current = 0
      instanceRef.current?.redraw()
      celebrationAnimationRef.current = null
    }

    celebrationAnimationRef.current = window.requestAnimationFrame(animate)
  }, [celebrateGoal, currentCell])

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
