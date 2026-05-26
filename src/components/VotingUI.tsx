import React from 'react';
import { VoteData, ColorState } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface VotingUIProps {
  votes: VoteData;
  constraintPattern?: ColorState[]; // UnWordle: show the pattern to match
}

export function VotingUI({ votes, constraintPattern }: VotingUIProps) {
  const sortedVotes = Object.entries(votes).sort((a, b) => (b[1] as number) - (a[1] as number));
  const topVote = sortedVotes[0];
  const otherVotes = sortedVotes.slice(1, 5);

  return (
    <div className="mt-2 space-y-2 w-full">
      {/* Constraint pattern indicator for UnWordle */}
      {constraintPattern && (
        <div className="text-center mb-2">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-1.5">Pola Yang Harus Dipenuhi</p>
          <div className="constraint-pattern mx-auto w-fit">
            {constraintPattern.map((color, idx) => (
              <div
                key={idx}
                className={`constraint-dot ${
                  color === 'correct' ? 'constraint-dot-correct' :
                  color === 'present' ? 'constraint-dot-present' :
                  'constraint-dot-absent'
                }`}
                title={
                  color === 'correct' ? 'Huruf harus tepat di posisi ini' :
                  color === 'present' ? 'Huruf ada tapi bukan di posisi ini' :
                  'Huruf tidak ada di kata jawaban'
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="text-center min-h-[72px]">
        <p className="text-slate-200 font-bold text-xs uppercase tracking-widest mb-1">Voting Tertinggi</p>
        <AnimatePresence mode="popLayout">
          {topVote ? (
            <motion.div
              key={topVote[0]}
              initial={{ scale: 0.8, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 1.2, opacity: 0, y: -10 }}
              className="inline-block bg-slate-800 border border-slate-700 px-6 py-2 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.3)]"
            >
              <span className="text-2xl font-bold tracking-widest">{topVote[0]}</span>
              <span className="vote-badge text-sm ml-3">{topVote[1]} VOTES</span>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="inline-block text-slate-500 px-8 py-3 h-[50px] flex items-center justify-center font-medium"
            >
              {constraintPattern ? 'Kirim kata yang cocok dengan pola!' : 'Belum ada tebakan valid'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full mt-2 h-[70px] flex justify-center">
        {otherVotes.length > 0 && (
          <div className="flex flex-col items-center animate-in fade-in duration-500">
            <p className="text-slate-300 font-bold text-[10px] uppercase tracking-widest mb-3">Tebakan Lainnya</p>
            <div className="flex justify-center flex-nowrap gap-2 max-w-full overflow-hidden px-4">
              <AnimatePresence mode="popLayout">
                {otherVotes.map(([word, count]) => (
                  <motion.div
                    key={word}
                    layout // Ensure layout animations
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="bg-slate-800/40 border border-slate-700/60 px-2 py-1 rounded-md flex items-center gap-2 backdrop-blur-sm flex-shrink-0"
                  >
                    <span className="text-slate-300 font-bold uppercase text-sm tracking-wide">{word}</span>
                    <span className="text-blue-400 text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded font-mono font-bold leading-none">{count}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
