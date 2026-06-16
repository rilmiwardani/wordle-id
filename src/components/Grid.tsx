import React from 'react';
import { Guess } from '../types';
import { motion } from 'motion/react';

interface GridProps {
  guesses: Guess[];
  currentRow: number;
  wordLength: number;
  rowCount?: number;
}

export function Grid({ guesses, currentRow, wordLength, rowCount = 5 }: GridProps) {
  const rows = Array.from({ length: rowCount });

  return (
    <motion.div 
      layout
      className="flex flex-col items-center justify-center gap-2 w-full mt-2 mb-4"
      style={{ '--tile-size': `min(55px, calc((100vw - 40px - (${wordLength} - 1) * 8px) / ${wordLength}))` } as React.CSSProperties}
    >
      {rows.map((_, i) => {
        const guess = guesses[i];
        const isCurrentRow = i === currentRow && !guess;
        const isPending = i > currentRow;
        const isNewestGuess = guess && i === guesses.length - 1;

        return (
          <motion.div layout key={i} className={`flex gap-1.5 relative max-w-full ${isCurrentRow ? 'active-row p-1.5' : ''}`}>
            {Array.from({ length: wordLength }).map((_, j) => {
              const letter = guess ? guess.word[j] : '';
              const state = guess ? guess.colors[j] : 'empty';
              
              let tileClass = "tile";
              let bgVar = 'var(--color-tile-empty)';
              
              if (isCurrentRow) {
                 tileClass += " text-blue-300";
                 bgVar = 'transparent';
              } else if (state === 'correct') {
                 bgVar = 'var(--color-tile-correct)';
              } else if (state === 'present') {
                 bgVar = 'var(--color-tile-present)';
              } else if (state === 'absent') {
                 bgVar = 'var(--color-tile-absent)';
              } else {
                 if (isPending) {
                     if (i === currentRow + 1) tileClass += " opacity-50";
                     else if (i === currentRow + 2) tileClass += " opacity-30";
                     else tileClass += " opacity-20";
                 }
              }

              return (
                <motion.div
                  key={`${i}-${j}`}
                  layout
                  initial={false}
                  animate={
                    isNewestGuess 
                      ? { 
                          rotateX: [0, 90, 0],
                          backgroundColor: ['var(--color-tile-empty)', 'var(--color-tile-empty)', bgVar],
                          scale: [1, 1.1, 1]
                        } 
                      : { 
                          rotateX: 0,
                          backgroundColor: bgVar,
                          scale: 1
                        }
                  }
                  transition={{ 
                    duration: 0.6,
                    delay: isNewestGuess ? j * 0.25 : 0,
                    times: [0, 0.5, 1]
                  }}
                  className={tileClass}
                >
                  {letter}
                </motion.div>
              );
            })}
            {isCurrentRow && (
              <motion.div layout className="absolute -top-3 -right-3 bg-red-500 text-[10px] px-2 py-1 rounded-full font-bold animate-pulse text-white">VOTING</motion.div>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
