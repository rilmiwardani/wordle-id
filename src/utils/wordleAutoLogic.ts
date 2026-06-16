import { Guess, ColorState } from '../types';
import { getValidWords, getCommonWords, evaluateGuess } from './gameLogic';

export interface AutoWordlePuzzle {
  targetWord: string;
  prefilledGuesses: Guess[];
  possibleAnswersCount: number;
}

export function generateAutoWordle(wordLength: number, rowsToFill: number = 5): AutoWordlePuzzle {
  const allValidWords = getValidWords(wordLength);
  const commonWords = getCommonWords(wordLength);
  
  let targetWord = "";
  let prefilledGuesses: Guess[] = [];
  let possibleAnswersCount = 0;
  
  const maxAttempts = 20;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    targetWord = commonWords[Math.floor(Math.random() * commonWords.length)];
    let currentPossibilities = [...allValidWords];
    prefilledGuesses = [];
    
    let validPuzzle = true;
    
    for (let i = 0; i < rowsToFill; i++) {
      // Find a guess that keeps possibilities > 1
      // To make it look "rapi" (neat/logical), we can pick a word from the currentPossibilities
      // but we shouldn't pick the targetWord itself!
      const candidates = currentPossibilities.filter(w => w !== targetWord);
      
      if (candidates.length === 0) {
        // We accidentally narrowed it down to ONLY the target word too early.
        validPuzzle = false;
        break;
      }
      
      // To make it not too easy, we want to pick a guess that leaves AS MANY possibilities as possible.
      // So we sample up to 15 random candidates, and pick the one that results in the largest currentPossibilities.
      let bestGuess = "";
      let bestRemaining: string[] = [];
      let bestColors: ColorState[] = [];
      
      const sampleSize = Math.min(15, candidates.length);
      // Shuffle candidates to pick random sample
      const shuffled = [...candidates].sort(() => 0.5 - Math.random());
      const sample = shuffled.slice(0, sampleSize);
      
      for (const testGuess of sample) {
        const testColors = evaluateGuess(testGuess, targetWord);
        const testRemaining = currentPossibilities.filter(w => {
          const wColors = evaluateGuess(testGuess, w);
          return wColors.every((c, idx) => c === testColors[idx]);
        });
        
        if (testRemaining.length > bestRemaining.length) {
          bestRemaining = testRemaining;
          bestGuess = testGuess;
          bestColors = testColors;
        }
      }
      
      if (!bestGuess || bestRemaining.length <= 1) {
        // Narrowed down too much, need to stop filling or retry puzzle
        if (i < rowsToFill - 1) {
          validPuzzle = false;
          break;
        }
      }
      
      prefilledGuesses.push({ word: bestGuess, colors: bestColors });
      currentPossibilities = bestRemaining;
    }
    
    // Enforce a minimum difficulty (e.g. at least 4 possible valid words left)
    if (validPuzzle && currentPossibilities.length >= 4) {
      possibleAnswersCount = currentPossibilities.length;
      return { targetWord, prefilledGuesses, possibleAnswersCount };
    }
  }
  
  // Fallback if we couldn't find a perfect one
  // Just pick some random valid words that aren't the target word
  targetWord = commonWords[Math.floor(Math.random() * commonWords.length)];
  prefilledGuesses = [];
  for (let i = 0; i < rowsToFill; i++) {
    let randomGuess = "";
    do {
      randomGuess = commonWords[Math.floor(Math.random() * commonWords.length)];
    } while (randomGuess === targetWord || prefilledGuesses.some(g => g.word === randomGuess));
    
    prefilledGuesses.push({ word: randomGuess, colors: evaluateGuess(randomGuess, targetWord) });
  }
  
  return { targetWord, prefilledGuesses, possibleAnswersCount: 2 }; // Just pretend it's > 1
}
