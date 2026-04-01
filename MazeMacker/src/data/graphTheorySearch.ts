import { stepGraphTheoryAStarSearch } from './graphTheorySearch.astar'
import { stepGraphTheoryDepthFirstSearch } from './graphTheorySearch.dfs'
import { stepGraphTheoryDijkstraSearch } from './graphTheorySearch.dijkstra'
import {
  GRAPH_THEORY_SEARCH_ALGORITHM_OPTIONS,
  completeGraphTheorySearch as completeGraphTheorySearchWithStep,
  createGraphTheorySearchState,
  type GraphTheorySearchAlgorithm,
  type GraphTheorySearchState,
} from './graphTheorySearch.shared'

export {
  createGraphTheorySearchState,
  GRAPH_THEORY_SEARCH_ALGORITHM_OPTIONS,
  type GraphTheorySearchAlgorithm,
  type GraphTheorySearchState,
}

export function stepGraphTheorySearch(
  state: GraphTheorySearchState,
): GraphTheorySearchState {
  if (state.isComplete) {
    return state
  }

  if (state.algorithm === 'dfs') {
    return stepGraphTheoryDepthFirstSearch(state)
  }

  if (state.algorithm === 'astar') {
    return stepGraphTheoryAStarSearch(state)
  }

  return stepGraphTheoryDijkstraSearch(state)
}

export function completeGraphTheorySearch(initialState: GraphTheorySearchState) {
  return completeGraphTheorySearchWithStep(initialState, stepGraphTheorySearch)
}
