import { useState, useEffect, useRef, useCallback } from 'react';
import { VoteData, FirstGuessers, Guesser, WordVoters } from '../types';
import { isValidWord, getRandomWord } from '../utils/gameLogic';
import { findValidWordsForPattern } from '../utils/unwordleLogic';
import { ColorState } from '../types';

interface UseTikTokLiveOptions {
  isActive: boolean;
  wordLength: number;
  // UnWordle mode: provide pattern + target for smart simulation
  unwordlePattern?: ColorState[];
  unwordleTarget?: string;
  unwordleForbiddenLetters?: Set<string>;
}

export function useTikTokLive({ isActive, wordLength, unwordlePattern, unwordleTarget, unwordleForbiddenLetters }: UseTikTokLiveOptions) {
  const [votes, setVotes] = useState<VoteData>({});
  const [firstGuessers, setFirstGuessers] = useState<FirstGuessers>({});
  const [wordVoters, setWordVoters] = useState<WordVoters>({});
  // Track users who have voted in the current round to prevent duplicate votes
  const [votedUsers, setVotedUsers] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);

  const isActiveRef = useRef(isActive);
  const wordLengthRef = useRef(wordLength);
  const votedUsersRef = useRef(votedUsers);
  const unwordlePatternRef = useRef(unwordlePattern);
  const unwordleTargetRef = useRef(unwordleTarget);
  const unwordleForbiddenLettersRef = useRef(unwordleForbiddenLetters);

  useEffect(() => {
    isActiveRef.current = isActive;
    wordLengthRef.current = wordLength;
    votedUsersRef.current = votedUsers;
    unwordlePatternRef.current = unwordlePattern;
    unwordleTargetRef.current = unwordleTarget;
    unwordleForbiddenLettersRef.current = unwordleForbiddenLetters;
  }, [isActive, wordLength, votedUsers, unwordlePattern, unwordleTarget, unwordleForbiddenLetters]);

  const handleIncomingComment = useCallback((comment: string, guesser?: Guesser) => {
    // Sanitize: remove non-alphabetic characters to bypass filters (e.g. B A C O K -> BACOK)
    const guessedWord = comment.replace(/[^a-zA-Z]/g, '').toUpperCase();
    const currentLength = wordLengthRef.current;
    
    // Check if user has already voted in this round
    if (guesser && votedUsersRef.current.has(guesser.uniqueId)) {
      return; // Ignore vote if user already voted
    }
    
    // Validation: word must be valid length and exist in wordlist
    // (Constraint checking for UnWordle happens at round-end in the game hook)
    if (guessedWord.length === currentLength && isValidWord(guessedWord, currentLength)) {
      setVotes(prev => ({
        ...prev,
        [guessedWord]: (prev[guessedWord] || 0) + 1
      }));
      
      if (guesser) {
        // Record that this user has voted
        setVotedUsers(prev => {
          const newSet = new Set(prev);
          newSet.add(guesser.uniqueId);
          return newSet;
        });
        
        setFirstGuessers(prev => {
          if (!prev[guessedWord]) {
            return {
              ...prev,
              [guessedWord]: guesser
            };
          }
          return prev;
        });
        
        setWordVoters(prev => ({
          ...prev,
          [guessedWord]: [...(prev[guessedWord] || []), guesser]
        }));
      }
    }
  }, []);

  useEffect(() => {
    let ws: WebSocket;

    const connectWS = () => {
      try {
        ws = new WebSocket('ws://localhost:62024');

        ws.onopen = () => {
          console.log('Terhubung ke IndoFinity WebSocket');
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isActiveRef.current) return;

          try {
            const message = JSON.parse(event.data);
            const { event: eventType, data: eventData } = message;

            if (eventType === 'chat') {
              console.log(`@${eventData.uniqueId}: ${eventData.comment}`);
              handleIncomingComment(eventData.comment || '', {
                uniqueId: eventData.uniqueId,
                nickname: eventData.nickname || eventData.uniqueId,
                profilePictureUrl: eventData.profilePictureUrl || ''
              });
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        ws.onclose = () => {
          console.log('Koneksi WebSocket ditutup');
          setIsConnected(false);
          // Try to reconnect after 3 seconds
          setTimeout(connectWS, 3000);
        };

        ws.onerror = (err) => {
          console.error('WebSocket error:', err);
        };
      } catch (e) {
        console.error("Gagal memulai WebSocket", e);
      }
    };

    connectWS();

    return () => {
      if (ws) {
        ws.onclose = null; // Prevent reconnect on unmount
        ws.close();
      }
    };
  }, []);

  // --- SIMULATION LOGIC ---
  useEffect(() => {
    let interval: number;

    if (isActive && !isConnected) {
      interval = window.setInterval(() => {
        const isSpam = Math.random() > 0.7;

        let fakeComment: string;

        if (isSpam) {
          fakeComment = "spam komen ah";
        } else if (unwordlePattern && unwordleTarget) {
          // UnWordle simulation: try to find a word matching the current constraint
          // 70% chance to guess a matching word, 30% chance random word
          if (Math.random() > 0.3) {
            const matchingWords = findValidWordsForPattern(
              unwordlePattern, unwordleTarget, wordLength, 20, unwordleForbiddenLetters
            );
            if (matchingWords.length > 0) {
              fakeComment = matchingWords[Math.floor(Math.random() * matchingWords.length)];
            } else {
              fakeComment = getRandomWord(wordLength);
            }
          } else {
            fakeComment = getRandomWord(wordLength);
          }
        } else {
          // Regular Wordle simulation
          fakeComment = getRandomWord(wordLength);
        }
        
        const fakeGuesserId = Math.floor(Math.random() * 5).toString();
        const fakeGuesser: Guesser = {
          uniqueId: `user${fakeGuesserId}`,
          nickname: `Pemain ${fakeGuesserId}`,
          profilePictureUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${fakeGuesserId}`
        };

        handleIncomingComment(fakeComment, fakeGuesser);
      }, Math.random() * 800 + 400);
    }

    return () => clearInterval(interval);
  }, [isActive, isConnected, wordLength, unwordlePattern, unwordleTarget]);

  const clearVotes = useCallback(() => {
    setVotes({});
    setFirstGuessers({});
    setWordVoters({});
    setVotedUsers(new Set()); // Reset voted users for the new round
  }, []);

  return { votes, firstGuessers, wordVoters, handleIncomingComment, clearVotes, isConnected };
}
