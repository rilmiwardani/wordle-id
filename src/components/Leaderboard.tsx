import React from 'react';
import { PlayerScore } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Medal, Award } from 'lucide-react';

interface LeaderboardProps {
  leaderboard: PlayerScore[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ leaderboard }) => {
  // Hanya ambil Top 5
  const topPlayers = leaderboard.slice(0, 5);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <span className="font-black text-amber-400 text-lg">1</span>;
      case 1: return <span className="font-black text-slate-300 text-lg">2</span>;
      case 2: return <span className="font-black text-amber-700 text-lg">3</span>;
      default: return <span className="text-slate-500 font-black text-sm w-5 text-center">{index + 1}</span>;
    }
  };

  const getRankColor = (index: number) => {
    switch (index) {
      case 0: return 'border-amber-400/50 bg-amber-400/10 shadow-[0_0_15px_rgba(251,191,36,0.2)]';
      case 1: return 'border-slate-300/50 bg-slate-300/10';
      case 2: return 'border-amber-700/50 bg-amber-700/10';
      default: return 'border-slate-700/50 bg-slate-800/50';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="bg-slate-900/95 p-5 rounded-3xl border border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.7)] w-full max-w-sm mx-auto flex flex-col max-h-[80vh] my-auto"
    >
      <div className="flex items-center justify-center gap-3 mb-4">
        <h2 className="text-xl font-black text-white uppercase tracking-widest text-center drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
          Top Players
        </h2>
      </div>

      <div className="flex-1 overflow-hidden">
        {topPlayers.length === 0 ? (
          <div className="text-center text-slate-500 py-10 font-mono text-sm uppercase tracking-widest">
            Belum ada data pemain
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <AnimatePresence mode="popLayout">
              {topPlayers.map((player, index) => (
                <motion.div
                  layout
                  key={player.uniqueId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.05 }}
                  className={`flex items-center p-2.5 rounded-xl border ${getRankColor(index)} relative overflow-hidden group`}
                >
                  {/* Rank Indicator */}
                  <div className="w-8 flex justify-center shrink-0">
                    {getRankIcon(index)}
                  </div>

                  {/* Profile Picture */}
                  <div className="w-10 h-10 rounded-full bg-slate-700 shrink-0 overflow-hidden border border-slate-600 ml-2 relative">
                    {player.profilePictureUrl ? (
                      <img src={player.profilePictureUrl} alt={player.nickname} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-white text-lg uppercase">
                        {player.nickname.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="ml-3 flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm truncate tracking-tight group-hover:text-blue-400 transition-colors">
                      {player.nickname}
                    </h3>
                    <p className="text-xs text-slate-400 truncate opacity-60">@{player.uniqueId}</p>
                  </div>

                  {/* Score */}
                  <div className="ml-3 shrink-0 flex flex-col items-end">
                    <span className="font-black text-blue-400 text-lg drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]">
                      {player.score}
                    </span>
                    <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold -mt-1">
                      PTS
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-3 border-t border-slate-800 text-center text-[10px] text-slate-500 uppercase tracking-[0.2em]">
        Top 5 Global Leaderboard
      </div>
    </motion.div>
  );
};
