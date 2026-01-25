import React from 'react';
import { Player, Position, posKey, isSamePos, BoardState } from '../types';

interface JellyLayerProps {
  stones: Position[];
  color: Player;
  cellSize: number;
  lastMove?: Position | null;
  board: BoardState; // Added to check for obstructions
}

// Helper to check if a specific position exists in the set
const hasPos = (set: Set<string>, r: number, c: number) => set.has(`${r},${c}`);

export const JellyLayer: React.FC<JellyLayerProps> = ({ stones, color, cellSize, lastMove, board }) => {
  const stoneSet = new Set(stones.map(posKey));
  
  // Radius for the main stone body
  const r = cellSize * 0.46; 
  
  // Thickness for Orthogonal connections (Fused/Melting look)
  const thickBridge = cellSize * 0.45;
  
  // Thickness for Diagonal connections (Related/Linked look)
  // Much thinner to create the "bone/ligament" effect after filtering
  const thinLink = cellSize * 0.18; 

  const fillColor = color === Player.Black ? "#4b5563" : "#ffffff"; 
  
  const shapes: React.ReactElement[] = [];

  stones.forEach(s => {
    const cx = (s.col + 1) * cellSize;
    const cy = (s.row + 1) * cellSize;
    const key = posKey(s);
    
    // Check neighbors (My stones)
    const hasRight = hasPos(stoneSet, s.row, s.col + 1);
    const hasDown = hasPos(stoneSet, s.row + 1, s.col);
    
    // Check Diagonals (My stones)
    const hasDownRight = hasPos(stoneSet, s.row + 1, s.col + 1);
    const hasDownLeft = hasPos(stoneSet, s.row + 1, s.col - 1);

    // Animation check
    const isThisNew = isSamePos(s, lastMove);

    // 1. Render the Stone Circle
    shapes.push(
      <circle key={`stone-${key}`} cx={cx} cy={cy} r={r} fill={fillColor} />
    );

    // 2. Render Orthogonal "Fused" Connections (Thick Rects)
    if (hasRight) {
        const isRightNew = isSamePos({row: s.row, col: s.col + 1}, lastMove);
        shapes.push(
            <rect 
                key={`h-bridge-${key}`}
                x={cx} y={cy - thickBridge / 2}
                width={cellSize} height={thickBridge}
                fill={fillColor}
                className={isThisNew || isRightNew ? 'animate-connect-h' : ''}
            />
        );
    }

    if (hasDown) {
        const isDownNew = isSamePos({row: s.row + 1, col: s.col}, lastMove);
        shapes.push(
            <rect 
                key={`v-bridge-${key}`}
                x={cx - thickBridge / 2} y={cy}
                width={thickBridge} height={cellSize}
                fill={fillColor}
                className={isThisNew || isDownNew ? 'animate-connect-v' : ''}
            />
        );
    }

    // 3. Render Diagonal "Related" Connections (Thin Lines)
    // Rule: Only draw diagonal if the path is NOT blocked by ANY stone (friend or foe).
    // This represents "Qi" (breath/connection) which cannot pass through occupied points.
    
    // Case: Down-Right
    if (hasDownRight) {
        const rightKey = `${s.row},${s.col + 1}`;
        const downKey = `${s.row + 1},${s.col}`;
        // Connection is broken if ANY stone exists in the "cross" points
        const isBlocked = board.has(rightKey) || board.has(downKey);
        
        if (!isBlocked) {
            shapes.push(
                <line 
                    key={`diag-dr-${key}`}
                    x1={cx} y1={cy}
                    x2={cx + cellSize} y2={cy + cellSize}
                    stroke={fillColor}
                    strokeWidth={thinLink}
                    strokeLinecap="round"
                />
            );
        }
    }

    // Case: Down-Left
    if (hasDownLeft) {
        const leftKey = `${s.row},${s.col - 1}`;
        const downKey = `${s.row + 1},${s.col}`;
        const isBlocked = board.has(leftKey) || board.has(downKey);

        if (!isBlocked) {
            shapes.push(
                <line 
                    key={`diag-dl-${key}`}
                    x1={cx} y1={cy}
                    x2={cx - cellSize} y2={cy + cellSize}
                    stroke={fillColor}
                    strokeWidth={thinLink}
                    strokeLinecap="round"
                />
            );
        }
    }
  });

  return (
    <g filter="url(#gooey-stone)">
        {shapes}
    </g>
  );
};
