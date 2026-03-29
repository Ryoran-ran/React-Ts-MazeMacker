import { type MazeData } from '../components/MazeCanvas'
import { type MazeAlgorithm, type MazeDimensions } from './mazeGenerator'

export type MazeTransferPayload = {
  algorithm?: MazeAlgorithm
  dimensions?: MazeDimensions
  maze: MazeData
}
