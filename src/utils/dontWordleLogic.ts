import { ColorState, Guess } from '../types';
import { evaluateGuess, getValidWords } from './gameLogic';

export function isStrictHardModeValid(
  guess: string,
  previousGuesses: Guess[]
): boolean {
  for (const prev of previousGuesses) {
    const evalColors = evaluateGuess(prev.word, guess);
    for (let i = 0; i < prev.colors.length; i++) {
      if (evalColors[i] !== prev.colors[i]) {
        return false;
      }
    }
  }
  return true;
}

export function getRemainingDontWordleWords(
  length: number,
  previousGuesses: Guess[]
): string[] {
  const allWords = getValidWords(length);
  return allWords.filter(word => isStrictHardModeValid(word, previousGuesses));
}
