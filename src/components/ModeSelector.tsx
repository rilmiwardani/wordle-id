import React from 'react';
import { GameMode } from '../types';
import { motion } from 'motion/react';

interface ModeSelectorProps {
  mode: GameMode;
  onChange: (mode: GameMode) => void;
}

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      <button
        onClick={() => onChange('wordle')}
        className={`mode-btn ${mode === 'wordle' ? 'mode-btn-active' : 'mode-btn-inactive'}`}
      >
        <span className="mode-btn-label">WORDLE</span>
        {mode === 'wordle' && (
          <motion.div
            layoutId="mode-indicator"
            className="mode-btn-indicator"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
      </button>
      <button
        onClick={() => onChange('unwordle')}
        className={`mode-btn ${mode === 'unwordle' ? 'mode-btn-active' : 'mode-btn-inactive'}`}
      >
        <span className="mode-btn-label">UNWORDLE</span>
        {mode === 'unwordle' && (
          <motion.div
            layoutId="mode-indicator"
            className="mode-btn-indicator"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
      </button>
    </div>
  );
}
