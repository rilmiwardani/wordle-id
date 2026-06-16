import React, { useState, useEffect } from 'react';
import { Grid } from './components/Grid';
import { UnwordleGrid } from './components/UnwordleGrid';
import { VotingUI } from './components/VotingUI';
import { useTikTokLive } from './hooks/useTikTokLive';
import { Leaderboard } from './components/Leaderboard';
import { Guess, Guesser, PlayerScore, GameMode, UnwordlePuzzle, UnwordleRow } from './types';
import { getRandomWord, evaluateGuess } from './utils/gameLogic';
import { generatePuzzle, validateWordAgainstPattern, getDeadLetters, findValidWordsForPattern, countValidWordsForPattern } from './utils/unwordleLogic';
import { generateAutoWordle } from './utils/wordleAutoLogic';
import { getRemainingDontWordleWords, isStrictHardModeValid } from './utils/dontWordleLogic';
import { RefreshCcw, Tv } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const VOTING_TIME = 30;
const AVAILABLE_LENGTHS = [4, 5, 6, 7, 8, 9];
const MAX_UNWORDLE_FAILURES = 3; // max failed attempts per row before game over
const MAX_DONT_WORDLE_GUESSES = 5;
const MAX_DONT_WORDLE_UNDOS = 3;

export default function App() {
  // ===== SHARED STATE =====
  const [gameMode, setGameMode] = useState<GameMode>('wordle');
  const [wordLength, setWordLength] = useState<number>(5);
  const [showLengthMenu, setShowLengthMenu] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(VOTING_TIME);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [showOverlay, setShowOverlay] = useState<boolean>(false);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [fastestGuesser, setFastestGuesser] = useState<Guesser | null>(null);
  const [roundWinners, setRoundWinners] = useState<Guesser[]>([]);

  // ===== WORDLE STATE =====
  const [targetWord, setTargetWord] = useState<string>('');
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [currentRow, setCurrentRow] = useState<number>(0);

  // ===== UNWORDLE STATE =====
  const [puzzle, setPuzzle] = useState<UnwordlePuzzle | null>(null);
  const [unwordleFilledRows, setUnwordleFilledRows] = useState<UnwordleRow[]>([]);
  const [unwordleCurrentRow, setUnwordleCurrentRow] = useState<number>(0);
  const [unwordleFailures, setUnwordleFailures] = useState<number>(0);
  const [failedAttempt, setFailedAttempt] = useState<{ word: string; errorPositions: number[] } | null>(null);

  // ===== DONT WORDLE STATE =====
  const [dontWordleUndos, setDontWordleUndos] = useState<number>(MAX_DONT_WORDLE_UNDOS);
  const remainingDontWordleWords = gameMode === 'dont-wordle' ? getRemainingDontWordleWords(wordLength, guesses) : [];

  // ===== LEADERBOARD =====
  const leaderboardKey = gameMode === 'wordle' ? 'wordleLeaderboard' : (gameMode === 'unwordle' ? 'unwordleLeaderboard' : (gameMode === 'wordle-auto' ? 'wordleAutoLeaderboard' : (gameMode === 'dont-wordle' ? 'dontWordleLeaderboard' : 'unwordleHardLeaderboard')));
  const [leaderboard, setLeaderboard] = useState<Record<string, PlayerScore>>(() => {
    const saved = localStorage.getItem(leaderboardKey);
    return saved ? JSON.parse(saved) : {};
  });

  // Reload leaderboard when mode changes
  useEffect(() => {
    const saved = localStorage.getItem(leaderboardKey);
    setLeaderboard(saved ? JSON.parse(saved) : {});
  }, [leaderboardKey]);

  useEffect(() => {
    localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
  }, [leaderboard, leaderboardKey]);

  // ===== STREAKS =====
  const streakCurrentKey = gameMode === 'wordle' ? 'wordleCurrentStreak' : (gameMode === 'unwordle' ? 'unwordleCurrentStreak' : (gameMode === 'wordle-auto' ? 'wordleAutoCurrentStreak' : (gameMode === 'dont-wordle' ? 'dontWordleCurrentStreak' : 'unwordleHardCurrentStreak')));
  const streakBestKey = gameMode === 'wordle' ? 'wordleBestStreak' : (gameMode === 'unwordle' ? 'unwordleBestStreak' : (gameMode === 'wordle-auto' ? 'wordleAutoBestStreak' : (gameMode === 'dont-wordle' ? 'dontWordleBestStreak' : 'unwordleHardBestStreak')));
  
  const [currentStreak, setCurrentStreak] = useState<number>(() => {
    const saved = localStorage.getItem(streakCurrentKey);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [bestStreak, setBestStreak] = useState<number>(() => {
    const saved = localStorage.getItem(streakBestKey);
    return saved ? parseInt(saved, 10) : 0;
  });

  // Reload streaks when mode changes
  useEffect(() => {
    const savedCurrent = localStorage.getItem(streakCurrentKey);
    const savedBest = localStorage.getItem(streakBestKey);
    setCurrentStreak(savedCurrent ? parseInt(savedCurrent, 10) : 0);
    setBestStreak(savedBest ? parseInt(savedBest, 10) : 0);
  }, [streakCurrentKey, streakBestKey]);

  useEffect(() => {
    localStorage.setItem(streakCurrentKey, currentStreak.toString());
    localStorage.setItem(streakBestKey, bestStreak.toString());
  }, [currentStreak, bestStreak, streakCurrentKey, streakBestKey]);

  // ===== TIKTOK LIVE HOOK =====
  const currentUnwordlePattern = (gameMode.startsWith('unwordle') && puzzle && unwordleCurrentRow < puzzle.colorPatterns.length)
    ? puzzle.colorPatterns[unwordleCurrentRow]
    : undefined;
  const currentUnwordleTarget = (gameMode.startsWith('unwordle') && puzzle)
    ? puzzle.targetWord
    : undefined;
  const currentUnwordleForbidden = gameMode === 'unwordle-hard' && puzzle 
    ? getDeadLetters(unwordleFilledRows, puzzle.targetWord) 
    : undefined;

  const { votes, firstGuessers, wordVoters, clearVotes, isConnected } = useTikTokLive({
    isActive: gameState === 'playing',
    wordLength,
    unwordlePattern: currentUnwordlePattern,
    unwordleTarget: currentUnwordleTarget,
    unwordleForbiddenLetters: currentUnwordleForbidden,
  });

  // ===== INIT GAMES =====
  const initWordleGame = (prevWinningWord?: string, forceLength?: number) => {
    const activeLength = forceLength || wordLength;
    const newTarget = getRandomWord(activeLength);
    setTargetWord(newTarget);
    
    const initialGuessWord = (prevWinningWord && prevWinningWord.length === activeLength) 
      ? prevWinningWord 
      : getRandomWord(activeLength);
      
    const evaluatedColors = evaluateGuess(initialGuessWord, newTarget);
    
    setGuesses([
      { word: initialGuessWord, colors: evaluatedColors }
    ]);
    setCurrentRow(1);
    setTimeLeft(VOTING_TIME);
    setGameState('playing');
    setFastestGuesser(null);
    setShowOverlay(false);
    setShowLeaderboard(false);
    clearVotes();
  };

  const initUnwordleGame = (forceLength?: number) => {
    const activeLength = forceLength || wordLength;
    const newPuzzle = generatePuzzle(activeLength);
    setPuzzle(newPuzzle);
    setUnwordleFilledRows([]);
    setUnwordleCurrentRow(0);
    setUnwordleFailures(0);
    setFailedAttempt(null);
    setTimeLeft(VOTING_TIME);
    setGameState('playing');
    setFastestGuesser(null);
    setShowOverlay(false);
    setShowLeaderboard(false);
    clearVotes();
  };

  const initWordleAutoGame = (forceLength?: number) => {
    const activeLength = forceLength || wordLength;
    const autoPuzzle = generateAutoWordle(activeLength, 4); // 4 rows
    setTargetWord(autoPuzzle.targetWord);
    setGuesses(autoPuzzle.prefilledGuesses);
    setCurrentRow(autoPuzzle.prefilledGuesses.length);
    setTimeLeft(VOTING_TIME);
    setGameState('playing');
    setFastestGuesser(null);
    setShowOverlay(false);
    setShowLeaderboard(false);
    clearVotes();
  };

  const initDontWordleGame = (forceLength?: number) => {
    const activeLength = forceLength || wordLength;
    setTargetWord(getRandomWord(activeLength));
    setGuesses([]);
    setCurrentRow(0);
    setDontWordleUndos(MAX_DONT_WORDLE_UNDOS);
    setTimeLeft(VOTING_TIME);
    setGameState('playing');
    setFastestGuesser(null);
    setShowOverlay(false);
    setShowLeaderboard(false);
    clearVotes();
  };

  const initGame = (prevWinningWord?: string, forceLength?: number) => {
    if (gameMode === 'wordle') {
      initWordleGame(prevWinningWord, forceLength);
    } else if (gameMode === 'wordle-auto') {
      initWordleAutoGame(forceLength);
    } else if (gameMode === 'dont-wordle') {
      initDontWordleGame(forceLength);
    } else {
      initUnwordleGame(forceLength);
    }
  };

  // Init on mount or when word length / game mode changes
  useEffect(() => {
    initGame(undefined, wordLength);
  }, [wordLength, gameMode]);

  // ===== TIMER =====
  useEffect(() => {
    if (gameState !== 'playing') return;

    if (timeLeft > 0) {
      const timerId = window.setTimeout(() => {
        setTimeLeft(prv => prv - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    } else {
      handleRoundEnd();
    }
  }, [timeLeft, gameState]);

  // ===== AUTO RESTART & OVERLAY =====
  useEffect(() => {
    if (gameState === 'won') {
      const timerReveal = window.setTimeout(() => {
        setShowOverlay(true);
      }, 2500);

      const timerShow = window.setTimeout(() => {
        setShowLeaderboard(true);
      }, 10000);
      
      const timerRestart = window.setTimeout(() => {
        if (gameMode === 'wordle') {
          initWordleGame(guesses[guesses.length - 1]?.word);
        } else if (gameMode === 'wordle-auto') {
          initWordleAutoGame();
        } else if (gameMode === 'dont-wordle') {
          initDontWordleGame();
        } else {
          initUnwordleGame();
        }
      }, 20000);
      
      return () => {
        clearTimeout(timerReveal);
        clearTimeout(timerShow);
        clearTimeout(timerRestart);
      };
    } else if (gameState === 'lost') {
      const isUnwordle = gameMode.startsWith('unwordle');
      const revealDelay = isUnwordle ? 6500 : 2500;
      const restartDelay = isUnwordle ? 14000 : 10000;

      const timerReveal = window.setTimeout(() => {
        setShowOverlay(true);
      }, revealDelay);

      const timerRestart = window.setTimeout(() => {
        initGame();
      }, restartDelay);
      
      return () => {
        clearTimeout(timerReveal);
        clearTimeout(timerRestart);
      };
    }
  }, [gameState, guesses, wordLength, gameMode]);

  // ===== Clear failed attempt after a short delay =====
  useEffect(() => {
    if (failedAttempt) {
      const timer = window.setTimeout(() => {
        setFailedAttempt(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [failedAttempt]);

  // ===== CHECK IMPOSSIBLE STATE (KEMUNGKINAN KATA 0) =====
  useEffect(() => {
    if (gameState === 'playing' && gameMode.startsWith('unwordle') && puzzle && unwordleCurrentRow < puzzle.colorPatterns.length) {
      const currentPattern = puzzle.colorPatterns[unwordleCurrentRow];
      const forbiddenLetters = gameMode === 'unwordle-hard' 
        ? getDeadLetters(unwordleFilledRows, puzzle.targetWord) 
        : new Set<string>();
      
      const validCount = countValidWordsForPattern(currentPattern, puzzle.targetWord, wordLength, 1, forbiddenLetters);
      
      if (validCount === 0) {
        // Game is stuck! 0 possible words. Auto-fail the game.
        let currentForbidden = forbiddenLetters;
        const autoFilledRows = [...unwordleFilledRows];
        
        for (let i = unwordleCurrentRow; i < puzzle.colorPatterns.length; i++) {
          const pattern = puzzle.colorPatterns[i];
          const validWords = findValidWordsForPattern(pattern, puzzle.targetWord, wordLength, 1, currentForbidden);
          const autoWord = validWords.length > 0 ? validWords[0] : puzzle.targetWord;
          
          autoFilledRows.push({
            word: autoWord,
            pattern: pattern,
            isValid: true,
            errorPositions: [],
          });
          
          if (gameMode === 'unwordle-hard') {
            currentForbidden = getDeadLetters(autoFilledRows, puzzle.targetWord);
          }
        }
        
        // Mark as failed visually first
        const stuckWord = "BUNTU".padEnd(wordLength, 'X').substring(0, wordLength);
        setFailedAttempt({ word: stuckWord, errorPositions: Array.from({length: wordLength}, (_, i) => i) });
        
        setTimeout(() => {
          setUnwordleFilledRows(autoFilledRows);
          setUnwordleCurrentRow(puzzle.colorPatterns.length);
        }, 1500);

        setGameState('lost');
        setCurrentStreak(0);
      }
    }
  }, [unwordleCurrentRow, unwordleFilledRows, gameState, gameMode, puzzle, wordLength]);

  // ===== ROUND END =====
  const handleRoundEnd = () => {
    const sortedVotes = Object.entries(votes).sort((a, b) => (b[1] as number) - (a[1] as number));
    
    if (sortedVotes.length === 0) {
      // Just in case, if the possible words is 0, we shouldn't reset timer infinitely.
      // But our useEffect above should catch it first.
      setTimeLeft(VOTING_TIME);
      return;
    }
    
    const topVotedWord = sortedVotes[0][0];

    if (gameMode === 'wordle') {
      handleWordleRoundEnd(topVotedWord);
    } else if (gameMode === 'wordle-auto') {
      handleAutoWordleRoundEnd(topVotedWord);
    } else if (gameMode === 'dont-wordle') {
      handleDontWordleRoundEnd(topVotedWord);
    } else {
      handleUnwordleRoundEnd(topVotedWord);
    }
  };

  const handleAutoWordleRoundEnd = (topVotedWord: string) => {
    const colors = evaluateGuess(topVotedWord, targetWord);
    const newGuesses = [...guesses, { word: topVotedWord, colors }];
    setGuesses(newGuesses);
    
    const isWin = topVotedWord === targetWord;
    
    // Calculate points using unified simple scoring
    updateLeaderboard(topVotedWord, { isWordleWin: isWin, isLoss: !isWin, actualTargetWord: targetWord });
    
    if (isWin && wordVoters[topVotedWord]) {
      setRoundWinners(wordVoters[topVotedWord]);
      if (firstGuessers[topVotedWord]) setFastestGuesser(firstGuessers[topVotedWord]);
    } else if (!isWin && wordVoters[targetWord]) {
      setRoundWinners(wordVoters[targetWord]);
      if (firstGuessers[targetWord]) setFastestGuesser(firstGuessers[targetWord]);
    } else {
      setRoundWinners([]);
      setFastestGuesser(null);
    }

    clearVotes();
    
    if (isWin) {
      setGameState('won');
      setCurrentStreak(prev => {
        const newStreak = prev + 1;
        setBestStreak(currentBest => Math.max(currentBest, newStreak));
        return newStreak;
      });
    } else {
      setGameState('lost');
      setCurrentStreak(0);
    }
  };

  const handleWordleRoundEnd = (topVotedWord: string) => {
    const colors = evaluateGuess(topVotedWord, targetWord);
    const newGuesses = [...guesses, { word: topVotedWord, colors }];
    setGuesses(newGuesses);
    
    const isWin = topVotedWord === targetWord;
    const isLoss = !isWin && newGuesses.length >= 5;
    
    // Calculate points
    updateLeaderboard(topVotedWord, { isWordleWin: isWin, isLoss: isLoss, actualTargetWord: targetWord });
    
    if (isWin && wordVoters[topVotedWord]) {
      setRoundWinners(wordVoters[topVotedWord]);
      if (firstGuessers[topVotedWord]) setFastestGuesser(firstGuessers[topVotedWord]);
    } else if (isLoss && wordVoters[targetWord]) {
      setRoundWinners(wordVoters[targetWord]);
      if (firstGuessers[targetWord]) setFastestGuesser(firstGuessers[targetWord]);
    } else {
      setRoundWinners([]);
      if (!isWin && !isLoss) setFastestGuesser(null);
    }
    
    clearVotes();
    
    if (isWin) {
      setGameState('won');
      setCurrentStreak(prev => {
        const newStreak = prev + 1;
        setBestStreak(currentBest => Math.max(currentBest, newStreak));
        return newStreak;
      });
    } else if (newGuesses.length >= 5) {
      setGameState('lost');
      setCurrentStreak(0);
    } else {
      setCurrentRow(prev => prev + 1);
      setTimeLeft(VOTING_TIME);
    }
  };

  const handleDontWordleRoundEnd = (topVotedWord: string) => {
    // 1. Is it the target word?
    if (topVotedWord === targetWord) {
      const colors = evaluateGuess(topVotedWord, targetWord);
      setGuesses(prev => [...prev, { word: topVotedWord, colors }]);
      setGameState('lost');
      setCurrentStreak(0);
      updateLeaderboard(topVotedWord, { isLoss: true, actualTargetWord: targetWord });
      clearVotes();
      return;
    }

    // 2. Is it a valid strict hard mode guess?
    if (!isStrictHardModeValid(topVotedWord, guesses)) {
      // Show failed attempt, don't use up a row
      setFailedAttempt({ word: topVotedWord, errorPositions: Array.from({length: wordLength}, (_, i) => i) });
      setTimeLeft(VOTING_TIME);
      updateLeaderboard(topVotedWord, {});
      clearVotes();
      return;
    }

    // 3. Valid guess
    const colors = evaluateGuess(topVotedWord, targetWord);
    const newGuesses = [...guesses, { word: topVotedWord, colors }];
    setGuesses(newGuesses);
    setCurrentRow(prev => prev + 1);
    
    // Check win condition
    if (newGuesses.length >= MAX_DONT_WORDLE_GUESSES) {
      setGameState('won');
      setCurrentStreak(prev => {
        const newStreak = prev + 1;
        setBestStreak(currentBest => Math.max(currentBest, newStreak));
        return newStreak;
      });
      // Reward points
      updateLeaderboard(topVotedWord, { isWordleWin: true });
    } else {
      setTimeLeft(VOTING_TIME);
      updateLeaderboard(topVotedWord, { isWordleWin: false });
    }
    clearVotes();
  };

  const handleUnwordleRoundEnd = (topVotedWord: string) => {
    if (!puzzle) return;

    const currentPattern = puzzle.colorPatterns[unwordleCurrentRow];
    const forbiddenLetters = gameMode === 'unwordle-hard' 
      ? getDeadLetters(unwordleFilledRows, puzzle.targetWord) 
      : new Set<string>();
      
    const validation = validateWordAgainstPattern(topVotedWord, currentPattern, puzzle.targetWord, forbiddenLetters);

    if (validation.isValid) {
      // Word matches the constraint!
      const newRow: UnwordleRow = {
        word: topVotedWord,
        pattern: currentPattern,
        isValid: true,
        errorPositions: [],
      };
      const newFilledRows = [...unwordleFilledRows, newRow];
      setUnwordleFilledRows(newFilledRows);
      setFailedAttempt(null);
      setUnwordleFailures(0); // Reset failures for next row

      // Calculate points
      const isLastRow = unwordleCurrentRow >= puzzle.colorPatterns.length - 1;
      updateLeaderboard(topVotedWord, { 
        isValidUnwordleRow: true, 
        isUnwordleWin: isLastRow,
        isHardMode: gameMode === 'unwordle-hard'
      });

      if (isLastRow && wordVoters[topVotedWord]) {
        setRoundWinners(wordVoters[topVotedWord]);
      } else {
        setRoundWinners([]);
      }

      if (firstGuessers[topVotedWord]) {
        setFastestGuesser(firstGuessers[topVotedWord]);
      }

      clearVotes();

      if (isLastRow) {
        // All rows filled! Win!
        setGameState('won');
        setCurrentStreak(prev => {
          const newStreak = prev + 1;
          setBestStreak(currentBest => Math.max(currentBest, newStreak));
          return newStreak;
        });
      } else {
        // Move to next row
        setUnwordleCurrentRow(prev => prev + 1);
        setTimeLeft(VOTING_TIME);
      }
    } else {
      // Word doesn't match — show error
      setFailedAttempt({ word: topVotedWord, errorPositions: validation.errorPositions });
      const newFailures = unwordleFailures + 1;
      setUnwordleFailures(newFailures);

      // +1 participation for all voters anyway
      updateLeaderboard(topVotedWord, {});

      clearVotes();

      if (newFailures >= MAX_UNWORDLE_FAILURES) {
        // Too many failures on this row — game over
        // Auto-fill remaining rows to show a valid solution
        let currentForbidden = gameMode === 'unwordle-hard'
          ? getDeadLetters(unwordleFilledRows, puzzle.targetWord)
          : new Set<string>();
        
        const autoFilledRows = [...unwordleFilledRows];
        for (let i = unwordleCurrentRow; i < puzzle.colorPatterns.length; i++) {
          const pattern = puzzle.colorPatterns[i];
          const validWords = findValidWordsForPattern(pattern, puzzle.targetWord, wordLength, 1, currentForbidden);
          const autoWord = validWords.length > 0 ? validWords[0] : puzzle.targetWord;
          
          autoFilledRows.push({
            word: autoWord,
            pattern: pattern,
            isValid: true,
            errorPositions: [],
          });
          
          if (gameMode === 'unwordle-hard') {
            currentForbidden = getDeadLetters(autoFilledRows, puzzle.targetWord);
          }
        }
        
        // Delay auto-fill so users can see their failed guess before it gets replaced
        setTimeout(() => {
          setUnwordleFilledRows(autoFilledRows);
          setUnwordleCurrentRow(puzzle.colorPatterns.length);
        }, 1500);

        setGameState('lost');
        setCurrentStreak(0);
      } else {
        // Try again
        setTimeLeft(VOTING_TIME);
      }
    }
  };

  // ===== LEADERBOARD UPDATE =====
  const updateLeaderboard = (
    topVotedWord: string, 
    options: {
      isWordleWin?: boolean,
      isValidUnwordleRow?: boolean,
      isUnwordleWin?: boolean,
      isHardMode?: boolean,
      isLoss?: boolean,
      actualTargetWord?: string
    } = {}
  ) => {
    const { isWordleWin, isValidUnwordleRow, isUnwordleWin, isLoss, actualTargetWord } = options;
    
    setLeaderboard(prev => {
      const newLeaderboard = { ...prev };
      
      const ensureVoter = (voter: Guesser) => {
        if (!newLeaderboard[voter.uniqueId]) {
          newLeaderboard[voter.uniqueId] = { ...voter, score: 0 };
        }
      };

      // 1. Poin Tebakan Diterima (+10)
      // Diberikan jika itu tebakan Wordle biasa (selalu diterima kecuali kalah/gameover sebelum dihitung), 
      // ATAU tebakan Unwordle yang memenuhi syarat baris.
      const isWordleMode = !gameMode.startsWith('unwordle');
      if ((isWordleMode || isValidUnwordleRow) && wordVoters[topVotedWord]) {
        wordVoters[topVotedWord].forEach(voter => {
          ensureVoter(voter);
          newLeaderboard[voter.uniqueId].score += 10;
        });
      }

      // 2. Poin Menang (+50) & Tercepat (+20)
      if ((isWordleWin || isUnwordleWin) && wordVoters[topVotedWord]) {
        wordVoters[topVotedWord].forEach(voter => {
          ensureVoter(voter);
          newLeaderboard[voter.uniqueId].score += 50;
        });
        
        if (firstGuessers[topVotedWord]) {
          const fastest = firstGuessers[topVotedWord];
          ensureVoter(fastest);
          newLeaderboard[fastest.uniqueId].score += 20;
        }
      }

      // 3. Poin Penghibur Saat Kalah (+50 & +20)
      // Diberikan untuk yang diam-diam menebak jawaban benar meskipun vote terbanyak salah.
      if (isLoss && actualTargetWord && wordVoters[actualTargetWord]) {
        wordVoters[actualTargetWord].forEach(voter => {
          ensureVoter(voter);
          newLeaderboard[voter.uniqueId].score += 50;
        });
        
        if (firstGuessers[actualTargetWord]) {
          const fastest = firstGuessers[actualTargetWord];
          ensureVoter(fastest);
          newLeaderboard[fastest.uniqueId].score += 20;
        }
      }

      return newLeaderboard;
    });
  };

  const restartGame = () => {
    if (gameMode === 'wordle') {
      initWordleGame(gameState === 'won' ? guesses[guesses.length - 1].word : undefined);
    } else if (gameMode === 'wordle-auto') {
      initWordleAutoGame();
    } else {
      initUnwordleGame();
    }
  };

  const handleModeChange = () => {
    // Masuk mode fullscreen jika belum
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
      }
    } catch (e) {
      console.log('Fullscreen API not supported or blocked');
    }

    if (gameMode === 'wordle') setGameMode('wordle-auto');
    else if (gameMode === 'wordle-auto') setGameMode('unwordle');
    else if (gameMode === 'unwordle') setGameMode('unwordle-hard');
    else if (gameMode === 'unwordle-hard') setGameMode('dont-wordle');
    else setGameMode('wordle');
  };

  const handleUndo = () => {
    if (gameMode !== 'dont-wordle' || gameState !== 'playing' || guesses.length === 0 || dontWordleUndos <= 0) return;
    setDontWordleUndos(prev => prev - 1);
    setGuesses(prev => prev.slice(0, -1));
    setCurrentRow(prev => prev - 1);
  };

  // Determine what target word to show on loss
  const displayTargetWord = (gameMode === 'wordle' || gameMode === 'wordle-auto' || gameMode === 'dont-wordle') ? targetWord : (puzzle?.targetWord || '');

  return (
    <div className="wordle-container">
      
      {/* Header */}
      <div className="flex flex-col items-center justify-center mb-3 w-full text-center">
        <h1 
          onClick={handleModeChange}
          className={`text-3xl sm:text-4xl font-black tracking-widest mb-1 cursor-pointer hover:opacity-80 transition-opacity select-none ${gameMode === 'unwordle-hard' ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]' : gameMode === 'dont-wordle' ? 'text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'text-white'}`}
          title={
            gameMode === 'wordle' ? 'Klik untuk ganti ke Mode Auto' :
            gameMode === 'wordle-auto' ? 'Klik untuk ganti ke UnWordle' :
            gameMode === 'unwordle' ? 'Klik untuk ganti ke UnWordle (Hard)' :
            gameMode === 'unwordle-hard' ? 'Klik untuk ganti ke Don\'t Wordle' :
            'Klik untuk ganti ke Wordle'
          }
        >
          {gameMode === 'wordle' ? 'WORDLE.ID' : gameMode === 'wordle-auto' ? 'MODE AUTO' : gameMode === 'dont-wordle' ? 'DON\'T WORDLE' : 'UNWORDLE.ID'}
        </h1>
        <div className="flex items-center justify-center gap-3 mt-1 w-full flex-wrap">

          <div className="text-slate-400 text-sm flex items-center justify-center gap-1.5 relative">
            Kirim 
            <div className="relative">
              <button 
                onClick={() => setShowLengthMenu(!showLengthMenu)}
                className="font-bold text-white hover:text-blue-400 transition-colors border-b border-dashed border-slate-500 hover:border-blue-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded"
              >
                {wordLength} huruf
              </button>
              
              <AnimatePresence>
                {showLengthMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1e293b] border border-slate-700/80 rounded-xl shadow-2xl z-50 flex flex-col p-1.5 min-w-[100px]"
                  >
                    {AVAILABLE_LENGTHS.map(len => (
                      <button
                        key={len}
                        onClick={() => {
                          setWordLength(len);
                          setShowLengthMenu(false);
                        }}
                        className={`text-xs px-3 py-2 whitespace-nowrap rounded-lg text-center transition-all ${
                          len === wordLength 
                            ? 'bg-blue-500/20 text-blue-400 font-bold' 
                            : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                        }`}
                      >
                        {len} Huruf
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            di chat untuk voting!
          </div>
        </div>


      </div>

      {/* Main Game Area */}
      <div className="flex flex-col relative w-full items-center">
        {/* Streak Display */}
        <div className="w-full max-w-md mx-auto mb-2 flex justify-center gap-4">
          <div className="flex bg-slate-800/50 rounded-full px-4 py-1.5 border border-slate-700/50 shadow-inner items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-400">Streak</span>
            <span className="text-sm font-black text-amber-400">{currentStreak}</span>
          </div>
          <div className="flex bg-slate-800/50 rounded-full px-4 py-1.5 border border-slate-700/50 shadow-inner items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-400">Best</span>
            <span className="text-sm font-black text-white">{bestStreak}</span>
          </div>
          {gameMode === 'unwordle' && (
            <div className="flex bg-slate-800/50 rounded-full px-4 py-1.5 border border-slate-700/50 shadow-inner items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-400">Sisa Gagal</span>
              <span className={`text-sm font-black ${unwordleFailures >= 2 ? 'text-red-400' : 'text-emerald-400'}`}>
                {MAX_UNWORDLE_FAILURES - unwordleFailures}
              </span>
            </div>
          )}
          {gameMode === 'dont-wordle' && (
            <div className="flex bg-slate-800/50 rounded-full px-4 py-1.5 border border-slate-700/50 shadow-inner items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-400">UNDOS</span>
              <span className={`text-sm font-black ${dontWordleUndos > 0 ? 'text-amber-400' : 'text-red-500'}`}>{dontWordleUndos}</span>
              {dontWordleUndos > 0 && guesses.length > 0 && gameState === 'playing' && (
                <button onClick={handleUndo} className="ml-2 bg-blue-500 hover:bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-bold transition-colors shadow-md">UNDO</button>
              )}
            </div>
          )}
        </div>

        {/* Minimalist Time Bar */}
        {gameMode === 'dont-wordle' && gameState === 'playing' && (
          <div className="w-full max-w-md mx-auto mb-1 flex flex-col items-center">
            <span className="text-xs uppercase font-black text-amber-300 drop-shadow-md">
              {remainingDontWordleWords.length} KATA TERSISA
            </span>
          </div>
        )}
        <div className="w-full max-w-md mx-auto mb-3">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Waktu Voting</span>
            <span className={`text-sm font-mono font-bold ${gameState === 'playing' ? 'text-blue-400' : 'text-slate-500'}`}>00:{timeLeft.toString().padStart(2, '0')}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden shadow-inner">
            <motion.div 
              className={`h-full ${
                gameState === 'playing' 
                  ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                  : 'bg-slate-600'
              }`}
              initial={{ width: '100%' }}
              animate={{ width: `${(timeLeft / VOTING_TIME) * 100}%` }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>
        </div>

        {/* Grid — conditional on mode */}
        {gameMode === 'wordle' || gameMode === 'wordle-auto' || gameMode === 'dont-wordle' ? (
          <Grid guesses={guesses} currentRow={currentRow} wordLength={wordLength} rowCount={gameMode === 'dont-wordle' ? MAX_DONT_WORDLE_GUESSES : 5} />
        ) : (
          puzzle && (
            <UnwordleGrid
              puzzle={puzzle}
              filledRows={unwordleFilledRows}
              currentRow={unwordleCurrentRow}
              wordLength={wordLength}
              failedAttempt={failedAttempt}
              deadLetters={currentUnwordleForbidden || new Set()}
            />
          )
        )}

        {/* Overlay for Win/Loss Result */}
        <AnimatePresence>
          {showOverlay && gameState !== 'playing' && (
            <motion.div 
              initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
              exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 z-20 flex flex-col bg-slate-950/80 rounded-xl p-4 text-center overflow-y-auto"
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={showLeaderboard ? "w-full my-auto shrink-0" : "bg-slate-900/90 p-6 rounded-3xl border border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-sm w-full mx-auto my-auto shrink-0"}
              >
                {showLeaderboard ? (
                  <Leaderboard leaderboard={(Object.values(leaderboard) as PlayerScore[]).sort((a, b) => b.score - a.score)} />
                ) : (
                  <>
                    <motion.h2 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                  className={`text-xl sm:text-2xl md:text-3xl font-extrabold mb-2 uppercase tracking-normal sm:tracking-wide whitespace-nowrap ${gameState === 'won' ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]' : 'text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.4)]'}`}
                >
                  {gameState === 'won' 
                    ? (gameMode.startsWith('unwordle') ? 'PUZZLE TERPECAHKAN!' : gameMode === 'dont-wordle' ? 'SELAMAT BERTAHAN!' : 'BERHASIL MENEBAK!') 
                    : (gameMode.startsWith('unwordle') ? 'GAGAL MEMECAHKAN' : gameMode === 'dont-wordle' ? 'TERTEBAK KATA RAHASIA!' : 'GAGAL MENEBAK')}
                </motion.h2>
                
                {gameState === 'lost' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-slate-300 mt-6 mb-6"
                  >
                    {gameMode.startsWith('unwordle') ? (
                      <span className="block text-sm tracking-wider text-slate-300 mb-2 italic">
                        Grid telah diisi dengan contoh solusi valid.
                      </span>
                    ) : (
                      <>
                        <span className="block text-sm uppercase tracking-wider text-slate-500 mb-2">
                          Kata rahasia:
                        </span>
                        <span className="font-mono text-4xl font-bold text-white tracking-[0.2em] block drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] bg-slate-800/80 py-3 rounded-xl border border-slate-700/80">
                          {displayTargetWord}
                        </span>
                      </>
                    )}
                  </motion.div>
                )}
                
                {(gameState === 'won' || (gameState === 'lost' && (gameMode === 'wordle-auto' || gameMode === 'wordle') && roundWinners.length > 0)) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-slate-300 mt-4 mb-4 text-sm"
                  >
                    <p className="mb-2">
                      {gameState === 'won' 
                        ? (gameMode.startsWith('unwordle') ? 'Semua pola berhasil dipecahkan!' : gameMode === 'dont-wordle' ? 'Kalian bertahan dari menebak kata!' : 'Kalian menebak dengan benar!') 
                        : (gameMode === 'dont-wordle' ? 'Kalian malah menebak kata targetnya!' : 'Sayang sekali vote terbanyak salah!')}
                    </p>
                    <p className="text-amber-400 font-bold mb-3">
                      +{(gameState === 'won' ? '60' : '50')} PTS <span className="text-slate-300 font-normal">untuk {gameState === 'won' ? 'pemilih kata ini:' : 'yang menjawab benar:'}</span>
                    </p>
                    
                    {/* List Pemenang Ronde */}
                    {roundWinners.length > 0 && (
                      <div className="flex flex-col items-center mb-5">
                        <div className="flex justify-center -space-x-3 rtl:space-x-reverse">
                          {roundWinners.slice(0, 10).map((winner, index) => (
                            <div key={winner.uniqueId} className="relative hover:z-20 transition-transform hover:scale-110" style={{ zIndex: 10 - index }}>
                              {winner.profilePictureUrl ? (
                                <img src={winner.profilePictureUrl} className="w-8 h-8 rounded-full border-2 border-slate-900 shadow-sm" alt={winner.nickname} title={winner.nickname} />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold border-2 border-slate-900 shadow-sm text-white" title={winner.nickname}>
                                  {winner.nickname.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          ))}
                          {roundWinners.length > 10 && (
                            <div className="relative z-0">
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300 border-2 border-slate-900 shadow-sm">
                                +{roundWinners.length - 10}
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-2">{roundWinners.length} penyumbang jawaban</span>
                      </div>
                    )}
                    
                    {fastestGuesser && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.8, type: "spring" }}
                        className="mt-5 flex flex-col items-center bg-slate-800/80 rounded-2xl p-4 border border-emerald-500/30 shadow-[0_0_20px_rgba(52,211,153,0.1)] relative overflow-hidden"
                      >
                        {/* Shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-emerald-400/10 to-transparent opacity-0 animate-[shimmer_2s_infinite]" />
                        
                        <span className="text-[10px] uppercase tracking-widest text-emerald-400 mb-3 font-bold">
                          {gameMode.startsWith('unwordle') ? 'Pemecah Tercepat' : 'Penebak Tercepat'} <span className="text-amber-400 ml-1">+{gameMode.startsWith('unwordle') ? '15' : '25'} PTS</span>
                        </span>
                        <div className="flex items-center gap-4 z-10">
                          {fastestGuesser.profilePictureUrl ? (
                            <img src={fastestGuesser.profilePictureUrl} alt={fastestGuesser.nickname} className="w-12 h-12 rounded-full border-2 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xl text-white border-2 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]">
                              {fastestGuesser.nickname.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex items-center text-left">
                            <span className="font-black text-white text-lg tracking-tight">{fastestGuesser.nickname}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="mt-8 relative"
                >
                  <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      className="h-full bg-slate-500"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 7.5, ease: 'linear' }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 uppercase mt-3 font-bold tracking-[0.2em]">
                    {gameState === 'won' ? 'Menyiapkan Leaderboard...' : 'Memulai ronde baru...'}
                  </p>
                </motion.div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Live Voting Display */}
      {gameState === 'playing' ? (
        <VotingUI 
          votes={votes} 
        />
      ) : (
        <div className="mt-2 space-y-2 w-full opacity-50 pointer-events-none">
          <VotingUI votes={{}} />
        </div>
      )}
      
      {/* BRANDING / STATUS */}
      <div className="flex justify-between items-end mt-auto pt-4 w-full">
          <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-[10px] text-slate-500 uppercase font-mono">{isConnected ? 'IndoFinity Stream Connected' : 'Disconnected (Simulation Mode)'}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
              SESSION ID: IND-WORD-{Math.floor(Math.random() * 9000) + 1000}
          </div>
      </div>
      
    </div>
  );
}