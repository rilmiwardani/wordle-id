import React, { useMemo } from 'react';
import { ColorState, UnwordlePuzzle, UnwordleRow } from '../types';
import { motion } from 'motion/react';
import { countValidWordsForPattern } from '../utils/unwordleLogic';

interface UnwordleGridProps {
  puzzle: UnwordlePuzzle;
  filledRows: UnwordleRow[];
  currentRow: number;
  wordLength: number;
  failedAttempt: { word: string; errorPositions: number[] } | null;
  deadLetters: Set<string>;
}

export function UnwordleGrid({ puzzle, filledRows, currentRow, wordLength, failedAttempt, deadLetters }: UnwordleGridProps) {
  const emptyRowCount = puzzle.rowCount - 1; // 5 empty rows
  const totalRows = puzzle.rowCount; // 6 total

  const validWordCounts = useMemo(() => {
    return puzzle.colorPatterns.map(pattern => 
      countValidWordsForPattern(pattern, puzzle.targetWord, wordLength, Infinity, deadLetters)
    );
  }, [puzzle, wordLength, deadLetters]);

  const getConstraintBg = (color: ColorState) => {
    switch (color) {
      case 'correct': return 'var(--color-tile-correct)';
      case 'present': return 'var(--color-tile-present)';
      case 'absent': return 'var(--color-tile-absent)';
      default: return 'var(--color-tile-empty)';
    }
  };

  const getConstraintBorder = (color: ColorState) => {
    switch (color) {
      case 'correct': return '#538d4e';
      case 'present': return '#b59f3b';
      case 'absent': return '#3a3a3c';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  };

  return (
    <motion.div
      layout
      className="flex-1 flex flex-col items-center justify-center gap-2 w-full"
      style={{ '--tile-size': `min(55px, calc((100vw - 40px - (${wordLength} - 1) * 8px) / ${wordLength}))` } as React.CSSProperties}
    >
      {/* Empty rows (0..4) */}
      {Array.from({ length: emptyRowCount }).map((_, rowIdx) => {
        const pattern = puzzle.colorPatterns[rowIdx];
        const filled = filledRows[rowIdx];
        const isCurrentRow = rowIdx === currentRow && !filled;
        const isPending = rowIdx > currentRow;
        const isNewestFilled = filled && rowIdx === filledRows.length - 1;

        // Check if this row just had a failed attempt
        const isFailedRow = failedAttempt && rowIdx === currentRow;

        return (
          <motion.div
            layout
            key={`unwordle-row-${rowIdx}`}
            className={`flex gap-1.5 relative max-w-full ${isCurrentRow ? 'active-row p-1.5' : ''}`}
          >
            {Array.from({ length: wordLength }).map((_, colIdx) => {
              const constraintColor = pattern[colIdx];
              const letter = filled ? filled.word[colIdx] : (isFailedRow ? failedAttempt.word[colIdx] : '');
              const isError = isFailedRow && failedAttempt.errorPositions.includes(colIdx);
              const bgColor = getConstraintBg(constraintColor);
              const borderColor = getConstraintBorder(constraintColor);

              let tileClass = 'tile unwordle-tile';
              let opacity = 1;

              if (isPending) {
                if (rowIdx === currentRow + 1) opacity = 0.5;
                else if (rowIdx === currentRow + 2) opacity = 0.3;
                else opacity = 0.2;
              }

              return (
                <motion.div
                  key={`${rowIdx}-${colIdx}`}
                  layout
                  initial={false}
                  animate={
                    isNewestFilled
                      ? {
                          rotateX: [0, 90, 0],
                          scale: [1, 1.05, 1],
                          opacity: 1,
                        }
                      : isFailedRow && isError
                        ? {
                            x: [0, -4, 4, -4, 4, 0],
                            opacity: 1,
                          }
                        : {
                            rotateX: 0,
                            scale: 1,
                            opacity,
                          }
                  }
                  transition={{
                    duration: isNewestFilled ? 0.6 : isFailedRow ? 0.4 : 0.3,
                    delay: isNewestFilled ? colIdx * 0.2 : 0,
                    times: isNewestFilled ? [0, 0.5, 1] : undefined,
                  }}
                  className={tileClass}
                  style={{
                    backgroundColor: bgColor,
                    borderColor: isError ? '#ef4444' : borderColor,
                    borderWidth: isError ? '3px' : '2px',
                    position: 'relative' as const,
                  }}
                >
                  {letter}
                  {/* Error triangle indicator */}
                  {isError && (
                    <div className="unwordle-error-triangle" />
                  )}

                </motion.div>
              );
            })}
            {isCurrentRow && (
              <motion.div layout className="absolute -top-3 -right-3 bg-red-500 text-[10px] px-2 py-1 rounded-full font-bold animate-pulse text-white z-10">
                VOTING
              </motion.div>
            )}
            {!filled && (
              <motion.div 
                layout 
                className="absolute top-1/2 -translate-y-1/2 -right-8 flex items-center justify-center bg-slate-800/60 border border-slate-700/50 w-6 h-6 rounded text-[9px] font-mono font-bold text-slate-400"
                title={`${validWordCounts[rowIdx]} kata tersedia`}
              >
                {validWordCounts[rowIdx]}
              </motion.div>
            )}
          </motion.div>
        );
      })}

      {/* Answer row (bottom, row 5) — pre-filled, all green */}
      <motion.div
        layout
        className="flex gap-1.5 relative max-w-full answer-row p-1.5"
      >
        {puzzle.targetWord.split('').map((letter, colIdx) => (
          <motion.div
            key={`answer-${colIdx}`}
            layout
            className="tile"
            style={{
              backgroundColor: 'var(--color-tile-correct)',
              borderColor: 'rgba(83, 141, 78, 0.8)',
              borderWidth: '2px',
            }}
          >
            {letter}
          </motion.div>
        ))}
        <motion.div layout className="absolute -top-3 -right-3 bg-emerald-500 text-[10px] px-2 py-1 rounded-full font-bold text-white">
          JAWABAN
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
