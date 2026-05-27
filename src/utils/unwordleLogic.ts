import { ColorState, UnwordlePuzzle, UnwordleRow } from '../types';
import { getValidWords, getCommonWords, evaluateGuess } from './gameLogic';

const EMPTY_ROW_COUNT = 4; // 4 empty rows + 1 answer row = 5 total

/**
 * Generate a valid UnWordle puzzle.
 * The puzzle has a target word (shown at the bottom, all green)
 * and color patterns for each empty row above it.
 * Each row's color pattern must have at least one valid word in the wordlist.
 */
export function generatePuzzle(wordLength: number): UnwordlePuzzle {
  const maxAttempts = 50;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const commonWords = getCommonWords(wordLength);
    const targetWord = commonWords[Math.floor(Math.random() * commonWords.length)];

    const colorPatterns = generateAllPatterns(wordLength, targetWord);
    if (colorPatterns) {
      return {
        targetWord,
        colorPatterns,
        rowCount: EMPTY_ROW_COUNT + 1, // 6 total
      };
    }
  }

  // Fallback: generate a simple puzzle with mostly green patterns
  const commonWords = getCommonWords(wordLength);
  const targetWord = commonWords[Math.floor(Math.random() * commonWords.length)];
  const colorPatterns = generateFallbackPatterns(wordLength, targetWord);
  return {
    targetWord,
    colorPatterns,
    rowCount: EMPTY_ROW_COUNT + 1,
  };
}

/**
 * Try to generate valid color patterns for all empty rows.
 * Returns null if any row can't find a valid pattern after retries.
 */
function generateAllPatterns(wordLength: number, targetWord: string): ColorState[][] | null {
  const patterns: ColorState[][] = [];

  for (let row = 0; row < EMPTY_ROW_COUNT; row++) {
    const pattern = generateSingleRowPattern(wordLength, targetWord, row);
    if (!pattern) return null;
    patterns.push(pattern);
  }

  return patterns;
}

/**
 * Generate a color pattern for a single row that has at least one valid word.
 * "Medium" difficulty: balanced mix of green, yellow, and gray tiles.
 * Strategy: pick a random valid word from the wordlist, evaluate it against the target,
 * and use the resulting colors as the pattern. This guarantees at least one solution.
 */
function generateSingleRowPattern(
  wordLength: number,
  targetWord: string,
  _rowIndex: number
): ColorState[] | null {
  const validWords = getValidWords(wordLength);
  const maxRetries = 80;

  for (let retry = 0; retry < maxRetries; retry++) {
    // Pick a random valid word
    const candidateWord = validWords[Math.floor(Math.random() * validWords.length)];

    // Skip if it's the same as the target (that would be all green, too easy)
    if (candidateWord === targetWord) continue;

    // Evaluate what colors this word would get
    const pattern = evaluateGuess(candidateWord, targetWord);

    // Medium difficulty filter:
    // - At least 1 green tile (not too hard)
    // - At most wordLength - 1 green tiles (not all green = too easy)
    // - At least 1 non-green tile (some challenge)
    const greenCount = pattern.filter(c => c === 'correct').length;
    const yellowCount = pattern.filter(c => c === 'present').length;
    const grayCount = pattern.filter(c => c === 'absent').length;

    // Medium: 1-2 greens for 5-letter, proportional for others
    const maxGreens = Math.max(2, Math.floor(wordLength * 0.4));
    const minGreens = 1;

    if (greenCount >= minGreens && greenCount <= maxGreens && (yellowCount > 0 || grayCount > 0)) {
      // Verify that at least 2 words in the wordlist can satisfy this pattern
      // (so it's not trivially "only one answer")
      const solutionCount = countValidWordsForPattern(pattern, targetWord, wordLength, 2);
      if (solutionCount >= 2) {
        return pattern;
      }
    }
  }

  // Fallback: just pick any word that's not the target and use its pattern
  for (const candidateWord of validWords) {
    if (candidateWord === targetWord) continue;
    const pattern = evaluateGuess(candidateWord, targetWord);
    const greenCount = pattern.filter(c => c === 'correct').length;
    if (greenCount < wordLength) {
      return pattern;
    }
  }

  return null;
}

/**
 * Generate simple fallback patterns (more greens, easier)
 */
function generateFallbackPatterns(wordLength: number, targetWord: string): ColorState[][] {
  const validWords = getValidWords(wordLength);
  const patterns: ColorState[][] = [];

  for (let row = 0; row < EMPTY_ROW_COUNT; row++) {
    let found = false;
    for (const word of validWords) {
      if (word !== targetWord) {
        patterns.push(evaluateGuess(word, targetWord));
        found = true;
        break;
      }
    }
    if (!found) {
      // Absolute fallback: all absent
      patterns.push(Array(wordLength).fill('absent'));
    }
  }

  return patterns;
}

/**
 * Validate whether a word satisfies the given color pattern for a target word.
 * 
 * Rules:
 * - Green (correct): The letter at this position must match the target at this position
 * - Yellow (present): The letter must exist somewhere in the target, but NOT at this position
 * - Gray (absent): The letter must NOT appear in the target word at all
 *                   (unless another instance of it is green/yellow)
 * 
 * We validate by evaluating the guess against the target and checking if the
 * resulting colors match the expected pattern.
 */
export function getDeadLetters(filledRows: UnwordleRow[], targetWord: string): Set<string> {
  const deadLetters = new Set<string>();
  for (const row of filledRows) {
    const pattern = evaluateGuess(row.word, targetWord);
    for (let i = 0; i < row.word.length; i++) {
      if (pattern[i] === 'absent' && !targetWord.includes(row.word[i])) {
        deadLetters.add(row.word[i]);
      }
    }
  }
  return deadLetters;
}

export function validateWordAgainstPattern(
  word: string,
  expectedPattern: ColorState[],
  targetWord: string,
  forbiddenLetters: Set<string> = new Set()
): { isValid: boolean; errorPositions: number[] } {
  const actualPattern = evaluateGuess(word, targetWord);
  const errorPositions: number[] = [];

  for (let i = 0; i < word.length; i++) {
    if (actualPattern[i] !== expectedPattern[i] || forbiddenLetters.has(word[i])) {
      errorPositions.push(i);
    }
  }

  return {
    isValid: errorPositions.length === 0,
    errorPositions,
  };
}

/**
 * Count how many valid words in the wordlist satisfy the given pattern.
 * Stops early once `minCount` is reached for efficiency.
 */
export function countValidWordsForPattern(
  pattern: ColorState[],
  targetWord: string,
  wordLength: number,
  minCount: number,
  forbiddenLetters: Set<string> = new Set()
): number {
  const validWords = getValidWords(wordLength);
  let count = 0;

  for (const word of validWords) {
    // Check forbidden letters first for efficiency
    let hasForbidden = false;
    for (let i = 0; i < wordLength; i++) {
      if (forbiddenLetters.has(word[i])) {
        hasForbidden = true;
        break;
      }
    }
    if (hasForbidden) continue;

    const actualPattern = evaluateGuess(word, targetWord);
    let matches = true;
    for (let i = 0; i < wordLength; i++) {
      if (actualPattern[i] !== pattern[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      count++;
      if (count >= minCount) return count;
    }
  }

  return count;
}

/**
 * Find valid words that satisfy the given pattern (for simulation mode).
 * Returns up to `limit` matching words.
 */
export function findValidWordsForPattern(
  pattern: ColorState[],
  targetWord: string,
  wordLength: number,
  limit: number = 10,
  forbiddenLetters: Set<string> = new Set()
): string[] {
  const validWords = getValidWords(wordLength);
  const matches: string[] = [];

  for (const word of validWords) {
    // Check forbidden letters first for efficiency
    let hasForbidden = false;
    for (let i = 0; i < wordLength; i++) {
      if (forbiddenLetters.has(word[i])) {
        hasForbidden = true;
        break;
      }
    }
    if (hasForbidden) continue;

    const actualPattern = evaluateGuess(word, targetWord);
    let isMatch = true;
    for (let i = 0; i < wordLength; i++) {
      if (actualPattern[i] !== pattern[i]) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) {
      matches.push(word);
      if (matches.length >= limit) break;
    }
  }

  return matches;
}
