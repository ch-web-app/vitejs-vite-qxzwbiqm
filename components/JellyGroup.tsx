import React from 'react';
import { Player, Position, posKey, isSamePos } from '../types';

interface JellyLayerProps {
  stones: Position[];
  color: Player;
  cellSize: number;
  lastMove?: Position | null;
}

// Helper to check if a specific position exists in the set
const hasPos = (set: Set<string>, r: number, c: number) => set.has(`${r},${c}`);

export const JellyLayer: React.FC<JellyLayerProps> = ({ stones, color, cellSize, lastMove }) => {
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
    
    // Check neighbors
    const hasRight = hasPos(stoneSet, s.row, s.col + 1);
    const hasDown = hasPos(stoneSet, s.row + 1, s.col);
    const hasLeft = hasPos(stoneSet, s.row, s.col - 1);
    const hasUp = hasPos(stoneSet, s.row - 1, s.col);

    // Check Diagonals
    const hasDownRight = hasPos(stoneSet, s.row + 1, s.col + 1);
    const hasDownLeft = hasPos(stoneSet, s.row + 1, s.col - 1);

    // Animation check
    const isThisNew = isSamePos(s, lastMove);

    // 1. Render the Stone Circle
    shapes.push(
      <circle key={`stone-${key}`} cx={cx} cy={cy} r={r} fill={fillColor} />
    );

    // 2. Render Orthogonal "Fused" Connections (Thick Rects)
    // We only draw Right and Down to avoid duplicates
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
    // Logic: Only connect diagonally if they are NOT sharing a common orthogonal neighbor.
    // This prevents drawing an X inside a solid 2x2 block.
    
    // Case: Down-Right
    if (hasDownRight && !hasRight && !hasDown) {
        // Draw line to bottom-right
        const endX = cx + cellSize;
        const endY = cy + cellSize;
        shapes.push(
            <line 
                key={`diag-dr-${key}`}
                x1={cx} y1={cy}
                x2={endX} y2={endY}
                stroke={fillColor}
                strokeWidth={thinLink}
                strokeLinecap="round"
            />
        );
    }

    // Case: Down-Left
    if (hasDownLeft && !hasLeft && !hasDown) {
        // Draw line to bottom-left
        const endX = cx - cellSize;
        const endY = cy + cellSize;
        shapes.push(
            <line 
                key={`diag-dl-${key}`}
                x1={cx} y1={cy}
                x2={endX} y2={endY}
                stroke={fillColor}
                strokeWidth={thinLink}
                strokeLinecap="round"
            />
        );
    }
  });

  return (
    <g filter="url(#gooey-stone)">
        {shapes}
    </g>
  );
};
