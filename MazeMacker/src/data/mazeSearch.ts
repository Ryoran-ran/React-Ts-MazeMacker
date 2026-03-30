import { stepAStarSearch } from './mazeSearch.astar'
import { stepBreadthFirstSearch } from './mazeSearch.bfs'
import { stepDeadEndFillingSearch } from './mazeSearch.deadEndFilling'
import { stepDepthFirstSearch } from './mazeSearch.dfs'
import { stepGoalPruningSearch } from './mazeSearch.goalPruning'
import { stepHumanAStarSearch } from './mazeSearch.humanAstar'
import { stepLeftHandSearch } from './mazeSearch.leftHand'
import { stepRightHandSearch } from './mazeSearch.rightHand'
import { stepTremauxSearch } from './mazeSearch.tremaux'
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

  if (state.algorithm === 'deadEndFilling') {
    return stepDeadEndFillingSearch(state)
  }

  if (state.algorithm === 'goalPruning') {
    return stepGoalPruningSearch(state)
  }

  if (state.algorithm === 'humanAstar') {
    return stepHumanAStarSearch(state)
  }

  if (state.algorithm === 'tremaux') {
    return stepTremauxSearch(state)
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
