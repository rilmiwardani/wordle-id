import React, { useState, useEffect } from 'react';
import { Grid } from './components/Grid';
import { UnwordleGrid } from './components/UnwordleGrid';
import { VotingUI } from './components/VotingUI';
import { useTikTokLive } from './hooks/useTikTokLive';
import { Leaderboard } from './components/Leaderboard';
import { Guess, Guesser, PlayerScore, GameMode, UnwordlePuzzle, UnwordleRow } from './types';
import { getRandomWord, evaluateGuess } from './utils/gameLogic';
import { generatePuzzle, validateWordAgainstPattern, getDeadLetters } from './utils/unwordleLogic';
import { RefreshCcw, Tv } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const VOTING_TIME = 30;
const AVAILABLE_LENGTHS = [4, 5, 6, 7, 8, 9];
const MAX_UNWORDLE_FAILURES = 3; // max failed attempts per row before game over

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

  // ===== LEADERBOARD =====
  const leaderboardKey = gameMode === 'wordle' ? 'wordleLeaderboard' : (gameMode === 'unwordle' ? 'unwordleLeaderboard' : 'unwordleHardLeaderboard');
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
  const streakCurrentKey = gameMode === 'wordle' ? 'wordleCurrentStreak' : (gameMode === 'unwordle' ? 'unwordleCurrentStreak' : 'unwordleHardCurrentStreak');
  const streakBestKey = gameMode === 'wordle' ? 'wordleBestStreak' : (gameMode === 'unwordle' ? 'unwordleBestStreak' : 'unwordleHardBestStreak');
  
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

  const initGame = (prevWinningWord?: string, forceLength?: number) => {
    if (gameMode === 'wordle') {
      initWordleGame(prevWinningWord, forceLength);
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
      const timerReveal = window.setTimeout(() => {
        setShowOverlay(true);
      }, 2500);

      const timerRestart = window.setTimeout(() => {
        initGame();
      }, 10000);
      
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

  // ===== ROUND END =====
  const handleRoundEnd = () => {
    const sortedVotes = Object.entries(votes).sort((a, b) => (b[1] as number) - (a[1] as number));
    
    if (sortedVotes.length === 0) {
      setTimeLeft(VOTING_TIME);
      return;
    }
    
    const topVotedWord = sortedVotes[0][0];

    if (gameMode === 'wordle') {
      handleWordleRoundEnd(topVotedWord);
    } else {
      handleUnwordleRoundEnd(topVotedWord);
    }
  };

  const handleWordleRoundEnd = (topVotedWord: string) => {
    const colors = evaluateGuess(topVotedWord, targetWord);
    const newGuesses = [...guesses, { word: topVotedWord, colors }];
    setGuesses(newGuesses);
    
    const isWin = topVotedWord === targetWord;
    
    if (isWin && firstGuessers[topVotedWord]) {
      setFastestGuesser(firstGuessers[topVotedWord]);
    }
    
    // Calculate points
    updateLeaderboard(topVotedWord, isWin, false);
    
    if (isWin && wordVoters[topVotedWord]) {
      setRoundWinners(wordVoters[topVotedWord]);
    } else {
      setRoundWinners([]);
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

      // Calculate points (isWin = false for now, check below)
      const isLastRow = unwordleCurrentRow >= puzzle.colorPatterns.length - 1;
      updateLeaderboard(topVotedWord, isLastRow, true);

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
      updateLeaderboard(topVotedWord, false, true);

      clearVotes();

      if (newFailures >= MAX_UNWORDLE_FAILURES) {
        // Too many failures on this row — game over
        setGameState('lost');
        setCurrentStreak(0);
      } else {
        // Try again
        setTimeLeft(VOTING_TIME);
      }
    }
  };

  // ===== LEADERBOARD UPDATE =====
  const updateLeaderboard = (topVotedWord: string, isWin: boolean, isUnwordle: boolean) => {
    setLeaderboard(prev => {
      const newLeaderboard = { ...prev };
      
      // +1 for participation
      (Object.entries(wordVoters) as [string, Guesser[]][]).forEach(([word, voters]) => {
        voters.forEach((voter: Guesser) => {
          if (!newLeaderboard[voter.uniqueId]) {
            newLeaderboard[voter.uniqueId] = { ...voter, score: 0 };
          }
          newLeaderboard[voter.uniqueId].score += 1;
        });
      });

      // +5 for majority
      if (wordVoters[topVotedWord]) {
        wordVoters[topVotedWord].forEach(voter => {
          newLeaderboard[voter.uniqueId].score += 5;
        });
      }

      // UnWordle bonus: +10 for valid constraint match
      if (isUnwordle && wordVoters[topVotedWord]) {
        wordVoters[topVotedWord].forEach(voter => {
          newLeaderboard[voter.uniqueId].score += 10;
        });
      }

      // +50 for win and +25 for fastest guesser
      if (isWin && wordVoters[topVotedWord]) {
        wordVoters[topVotedWord].forEach(voter => {
          newLeaderboard[voter.uniqueId].score += 50;
        });
        
        if (firstGuessers[topVotedWord]) {
          const fastest = firstGuessers[topVotedWord];
          newLeaderboard[fastest.uniqueId].score += 25;
        }
      }

      return newLeaderboard;
    });
  };

  const restartGame = () => {
    if (gameMode === 'wordle') {
      initWordleGame(gameState === 'won' ? guesses[guesses.length - 1].word : undefined);
    } else {
      initUnwordleGame();
    }
  };

  const handleModeChange = () => {
    if (gameMode === 'wordle') setGameMode('unwordle');
    else if (gameMode === 'unwordle') setGameMode('unwordle-hard');
    else setGameMode('wordle');
  };

  // Determine what target word to show on loss
  const displayTargetWord = gameMode === 'wordle' ? targetWord : (puzzle?.targetWord || '');

  return (
    <div className="wordle-container">
      
      {/* Header */}
      <div className="flex flex-col items-center justify-center mb-3 w-full text-center">
        <h1 
          onClick={handleModeChange}
          className={`text-3xl sm:text-4xl font-black tracking-widest mb-1 cursor-pointer hover:opacity-80 transition-opacity select-none ${gameMode === 'unwordle-hard' ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'text-white'}`}
          title={
            gameMode === 'wordle' ? 'Klik untuk ganti ke UnWordle' :
            gameMode === 'unwordle' ? 'Klik untuk ganti ke UnWordle (Hard)' :
            'Klik untuk ganti ke Wordle'
          }
        >
          {gameMode === 'wordle' ? 'WORDLE.ID' : 'UNWORDLE.ID'}
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
      <div className="flex-1 flex flex-col relative w-full items-center">
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
        </div>

        {/* Minimalist Time Bar */}
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
        {gameMode === 'wordle' ? (
          <Grid guesses={guesses} currentRow={currentRow} wordLength={wordLength} />
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
                    ? (gameMode === 'unwordle' ? 'PUZZLE TERPECAHKAN!' : 'BERHASIL MENEBAK!') 
                    : (gameMode === 'unwordle' ? 'GAGAL MEMECAHKAN' : 'GAGAL MENEBAK')}
                </motion.h2>
                
                {gameState === 'lost' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-slate-300 mt-6 mb-6"
                  >
                    <span className="block text-sm uppercase tracking-wider text-slate-500 mb-2">
                      {gameMode === 'unwordle' ? 'Kata jawaban:' : 'Kata rahasia:'}
                    </span>
                    <span className="font-mono text-4xl font-bold text-white tracking-[0.2em] block drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] bg-slate-800/80 py-3 rounded-xl border border-slate-700/80">
                      {displayTargetWord}
                    </span>
                  </motion.div>
                )}
                
                {gameState === 'won' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-slate-300 mt-4 mb-4 text-sm"
                  >
                    <p className="mb-2">
                      {gameMode === 'unwordle' 
                        ? 'Semua pola berhasil dipecahkan!' 
                        : 'Kalian menebak dengan benar!'}
                    </p>
                    <p className="text-amber-400 font-bold mb-3">
                      +{gameMode === 'unwordle' ? '66' : '56'} PTS <span className="text-slate-300 font-normal">untuk pemilih kata ini:</span>
                    </p>
                    
                    {/* List Pemenang Ronde */}
                    {roundWinners.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-2 mb-4">
                        {roundWinners.slice(0, 10).map(winner => (
                          <div key={winner.uniqueId} className="flex flex-col items-center w-10">
                            {winner.profilePictureUrl ? (
                              <img src={winner.profilePictureUrl} className="w-8 h-8 rounded-full border border-amber-400" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold border border-amber-400 text-white">{winner.nickname.charAt(0)}</div>
                            )}
                            <span className="text-[8px] truncate w-full text-center mt-1 text-slate-400">{winner.nickname.substring(0, 8)}</span>
                          </div>
                        ))}
                        {roundWinners.length > 10 && (
                          <div className="flex flex-col items-center justify-center w-10">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300 border border-slate-600">+{roundWinners.length - 10}</div>
                          </div>
                        )}
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
                          {gameMode === 'unwordle' ? 'Pemecah Tercepat' : 'Penebak Tercepat'} <span className="text-amber-400 ml-1">+25 PTS</span>
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
      <div className="flex justify-between items-end mt-2 w-full">
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