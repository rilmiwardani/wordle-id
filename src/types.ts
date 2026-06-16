export type ColorState = 'correct' | 'present' | 'absent' | 'empty';

export type GameMode = 'wordle' | 'unwordle' | 'unwordle-hard' | 'wordle-auto' | 'dont-wordle';

export interface Guess {
  word: string;
  colors: ColorState[];
}

export interface VoteData {
  [word: string]: number;
}

export interface Guesser {
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
}

export interface FirstGuessers {
  [word: string]: Guesser;
}

export interface WordVoters {
  [word: string]: Guesser[];
}

export interface PlayerScore extends Guesser {
  score: number;
}

// UnWordle types
export interface UnwordlePuzzle {
  targetWord: string;
  colorPatterns: ColorState[][];  // color pattern for each empty row (rows 0..4)
  rowCount: number;              // total rows including answer row (6)
}

export interface UnwordleRow {
  word: string;
  pattern: ColorState[];
  isValid: boolean;
  errorPositions: number[];  // positions where constraint was violated
}
