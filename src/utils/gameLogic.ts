import { ColorState } from '../types';
import wordlistData from '../data/wordlist.json';

// Get the array of words by length
export function getValidWords(length: number): string[] {
  const data = (wordlistData as Record<string, any>)[length.toString()];
  return data ? data.words.map((w: string) => w.toUpperCase()) : [];
}

// Get the array of common words by length for the target word
export function getCommonWords(length: number): string[] {
  const data = (wordlistData as Record<string, any>)[length.toString()];
  return data && data.common ? data.common.map((w: string) => w.toUpperCase()) : getValidWords(length);
}

export function getRandomWord(length: number): string {
  const commonWords = getCommonWords(length);
  if (commonWords.length === 0) return "".padEnd(length, "A");
  const randomIndex = Math.floor(Math.random() * commonWords.length);
  return commonWords[randomIndex];
}

export function isValidWord(word: string, length: number): boolean {
  const validWords = getValidWords(length);
  return validWords.includes(word.toUpperCase());
}

export function evaluateGuess(guess: string, target: string): ColorState[] {
  const length = target.length;
  const result: ColorState[] = Array(length).fill('absent');
  const targetChars = target.split('');
  const guessChars = guess.split('');

  // 1st pass: correct
  for (let i = 0; i < length; i++) {
    if (guessChars[i] === targetChars[i]) {
      result[i] = 'correct';
      targetChars[i] = '#'; // mark used
      guessChars[i] = '_'; // mark used
    }
  }

  // 2nd pass: present
  for (let i = 0; i < length; i++) {
    if (guessChars[i] !== '_') {
      const idx = targetChars.indexOf(guessChars[i]);
      if (idx !== -1) {
        result[i] = 'present';
        targetChars[idx] = '#';
      }
    }
  }

  return result;
}
