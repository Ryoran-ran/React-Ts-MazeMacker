import { useEffect, useState } from 'react'
import {
  completeMazeGeneration,
  createMazeGenerationState,
  stepMazeGeneration,
  type MazeAlgorithm,
  type MazeDimensions,
  type MazeGenerationState,
} from '../data/mazeGenerator'
import {
  MAZE_SEARCH_ALGORITHM_OPTIONS,
  completeMazeSearch,
  createMazeSearchState,
  stepMazeSearch,
  type MazeSearchAlgorithm,
  type MazeSearchState,
} from '../data/mazeSearch'
import type { MazeData, MazeWallDirection } from '../components/MazeCanvas'

type MazeSearchStateMap = Record<MazeSearchAlgorithm, MazeSearchState>

function createSearchStateMap(maze: MazeSearchState['maze']): MazeSearchStateMap {
  return {
    astar: createMazeSearchState(maze, 'astar'),
    bfs: createMazeSearchState(maze, 'bfs'),
    deadEndFilling: createMazeSearchState(maze, 'deadEndFilling'),
    dfs: createMazeSearchState(maze, 'dfs'),
    goalPruning: createMazeSearchState(maze, 'goalPruning'),
    humanAstar: createMazeSearchState(maze, 'humanAstar'),
    leftHand: createMazeSearchState(maze, 'leftHand'),
    tremaux: createMazeSearchState(maze, 'tremaux'),
    rightHand: createMazeSearchState(maze, 'rightHand'),
  }
}

function getDirectionBetween(
  from: { x: number; y: number },
  to: { x: number; y: number },
): MazeWallDirection | null {
  if (to.x === from.x && to.y === from.y - 1) {
    return 'top'
  }
  if (to.x === from.x + 1 && to.y === from.y) {
    return 'right'
  }
  if (to.x === from.x && to.y === from.y + 1) {
    return 'bottom'
  }
  if (to.x === from.x - 1 && to.y === from.y) {
    return 'left'
  }

  return null
}

export function getSolvedMazePathCost(searchState: MazeSearchState) {
  if (!searchState.isSolved) {
    return null
  }

  let totalCost = 0
  let current = searchState.goal

  while (!(current.x === searchState.start.x && current.y === searchState.start.y)) {
    const parent = searchState.parents[current.y][current.x]

    if (!parent) {
      return null
    }

    const direction = getDirectionBetween(parent, current)

    if (!direction) {
      return null
    }

    totalCost += searchState.maze[parent.y][parent.x].costs[direction]
    current = parent
  }

  return totalCost
}

export function useMazeMode(defaultDimensions: MazeDimensions, defaultAlgorithm: MazeAlgorithm) {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<MazeAlgorithm>(defaultAlgorithm)
  const [selectedSearchAlgorithms, setSelectedSearchAlgorithms] = useState<MazeSearchAlgorithm[]>([
    'astar',
  ])
  const [generationState, setGenerationState] = useState<MazeGenerationState>(() =>
    createMazeGenerationState(defaultDimensions, defaultAlgorithm, null),
  )
  const [searchStates, setSearchStates] = useState<MazeSearchStateMap>(() =>
    createSearchStateMap(createMazeGenerationState(defaultDimensions, defaultAlgorithm, null).maze),
  )

  useEffect(() => {
    setSearchStates(createSearchStateMap(generationState.maze))
  }, [generationState.maze])

  function handleGenerationStep() {
    setGenerationState((currentState) => stepMazeGeneration(currentState))
  }

  function handleGenerationComplete() {
    setGenerationState((currentState) => completeMazeGeneration(currentState))
  }

  function handleSearchStep() {
    setSearchStates((currentStates) => {
      const nextStates = { ...currentStates }

      for (const algorithm of selectedSearchAlgorithms) {
        nextStates[algorithm] = stepMazeSearch(nextStates[algorithm])
      }

      return nextStates
    })
  }

  function handleSearchComplete() {
    setSearchStates((currentStates) => {
      const nextStates = { ...currentStates }

      for (const algorithm of selectedSearchAlgorithms) {
        nextStates[algorithm] = completeMazeSearch(nextStates[algorithm])
      }

      return nextStates
    })
  }

  function handleSearchReset(nextMaze?: MazeData) {
    setSearchStates(createSearchStateMap(nextMaze ?? generationState.maze))
  }

  function handleSearchAlgorithmToggle(nextAlgorithm: MazeSearchAlgorithm) {
    setSelectedSearchAlgorithms((currentAlgorithms) => {
      if (currentAlgorithms.includes(nextAlgorithm)) {
        if (currentAlgorithms.length === 1) {
          return currentAlgorithms
        }

        return currentAlgorithms.filter((algorithm) => algorithm !== nextAlgorithm)
      }

      return [...currentAlgorithms, nextAlgorithm]
    })
  }

  return {
    generationState,
    handleGenerationComplete,
    handleGenerationStep,
    handleSearchAlgorithmToggle,
    handleSearchComplete,
    handleSearchReset,
    handleSearchStep,
    searchStates,
    selectedAlgorithm,
    selectedSearchAlgorithms,
    setGenerationState,
    setSearchStates,
    setSelectedAlgorithm,
  }
}

export { MAZE_SEARCH_ALGORITHM_OPTIONS }
export type { MazeSearchAlgorithm, MazeSearchState }
