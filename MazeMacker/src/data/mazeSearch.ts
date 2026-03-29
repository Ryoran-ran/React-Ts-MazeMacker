import { stepAStarSearch } from './mazeSearch.astar'
import { stepBreadthFirstSearch } from './mazeSearch.bfs'
import { stepDepthFirstSearch } from './mazeSearch.dfs'
import { stepLeftHandSearch } from './mazeSearch.leftHand'
import { stepRightHandSearch } from './mazeSearch.rightHand'
import {
  MAZE_SEARCH_ALGORITHM_OPTIONS,
  completeMazeSearch as completeMazeSearchWithStep,
  createMazeSearchState,
  type MazeSearchAlgorithm,
  type MazeSearchState,
} from './mazeSearch.shared'

export {
  createMazeSearchState,
  MAZE_SEARCH_ALGORITHM_OPTIONS,
  type MazeSearchAlgorithm,
  type MazeSearchState,
}

export function stepMazeSearch(state: MazeSearchState): MazeSearchState {
  if (state.isComplete) {
    return state
  }

  if (state.algorithm === 'rightHand') {
    return stepRightHandSearch(state)
  }

  if (state.algorithm === 'leftHand') {
    return stepLeftHandSearch(state)
  }

  if (state.algorithm === 'dfs') {
    return stepDepthFirstSearch(state)
  }

  if (state.algorithm === 'astar') {
    return stepAStarSearch(state)
  }

  return stepBreadthFirstSearch(state)
}

export function completeMazeSearch(initialState: MazeSearchState): MazeSearchState {
  return completeMazeSearchWithStep(initialState, stepMazeSearch)
}
