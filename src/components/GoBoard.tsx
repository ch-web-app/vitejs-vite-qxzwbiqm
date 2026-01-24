import React from 'react';
import { GoEngine } from '../services/goEngine';
import JellyGroup from './JellyGroup';

interface GoBoardProps {
  engine: GoEngine;
  onPlaceStone: (r: number, c: number) => void;
  tick: number; // Used to force re-render when engine updates
}

const GoBoard: React.FC<GoBoardProps> = ({ engine, onPlaceStone }) => {
  const size = engine.size;
  // Calculate rendering metrics
  // We use a viewBox based on the board size.
  // We add 1 cell padding around the board (from 0 to size+1).
  const cellSize = 40; 
  const boardSizePx = (size + 1) * cellSize;
  
  const groups = engine.getRenderGroups();

  // Generate grid lines
  const lines = [];
  for (let i = 1; i <= size; i++) {
    const p = i * cellSize;
    const len = size * cellSize;
    // Horizontal
    lines.push(<line key={`h-${i}`} x1={cellSize} y1={p} x2={len} y2={p} stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />);
    // Vertical
    lines.push(<line key={`v-${i}`} x1={p} y1={cellSize} x2={p} y2={len} stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />);
  }

  // Star points
  const getStarPoints = (sz: number) => {
    if (sz === 9) return [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]];
    if (sz === 13) return [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]];
    return [[3, 3], [3, 15], [15, 3], [15, 15], [9, 9], [3, 9], [9, 3], [15, 9], [9, 15]];
  };
  const starPoints = getStarPoints(size);

  return (
    <div className="relative inline-block rounded-2xl shadow-xl overflow-hidden bg-[#e6cda6]">
      <svg 
        width="100%" 
        height="100%" 
        viewBox={`0 0 ${boardSizePx} ${boardSizePx}`}
        className="block touch-none"
      >
        {/* Board Background */}
        <rect width={boardSizePx} height={boardSizePx} fill="#e6cda6" />
        
        {/* Grid Lines */}
        {lines}

        {/* Star Points */}
        {starPoints.map(([r, c], i) => (
          <circle 
            key={`star-${i}`} 
            cx={(c + 1) * cellSize} 
            cy={(r + 1) * cellSize} 
            r={cellSize * 0.1} 
            fill="rgba(0,0,0,0.4)" 
          />
        ))}

        {/* Stones (Jelly Groups) */}
        {groups.map((group) => (
          <JellyGroup key={group.id} group={group} cellSize={cellSize} />
        ))}

        {/* Interaction Layer (Invisible Taps) */}
        {Array.from({ length: size }).map((_, r) => 
          Array.from({ length: size }).map((_, c) => (
            <rect
              key={`tap-${r}-${c}`}
              x={(c + 0.5) * cellSize}
              y={(r + 0.5) * cellSize}
              width={cellSize}
              height={cellSize}
              fill="transparent"
              className="cursor-pointer hover:fill-black/5 active:fill-black/10 transition-colors"
              onClick={() => onPlaceStone(r, c)}
            />
          ))
        )}
      </svg>
    </div>
  );
};

export default GoBoard;