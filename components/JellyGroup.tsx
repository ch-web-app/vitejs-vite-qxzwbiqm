import React from 'react';
import { GroupInfo, Player, Position, posKey, isSamePos } from '../types';

interface JellyGroupProps {
  group: GroupInfo;
  cellSize: number;
  lastMove?: Position | null;
}

export const JellyGroup: React.FC<JellyGroupProps> = ({ group, cellSize, lastMove }) => {
  const { stones, player } = group;
  
  const stoneSet = new Set(stones.map(posKey));
  
  // Radius: Slightly larger to account for filter erosion
  const r = cellSize * 0.46; 
  
  // Bridge thickness: Used for the "flesh" fusion
  const bridgeThickness = cellSize * 0.45;

  const fillColor = player === Player.Black ? "#4b5563" : "#ffffff"; 
  
  // "Qi" Line color: distinct from the body to show the connection clearly
  // For black stones, use a semi-transparent light gray.
  // For white stones, use a semi-transparent dark gray.
  const qiLineColor = player === Player.Black ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)";

  const jellyShapes: React.ReactElement[] = [];
  const qiLines: React.ReactElement[] = [];

  stones.forEach(s => {
    const cx = (s.col + 1) * cellSize;
    const cy = (s.row + 1) * cellSize;
    const key = posKey(s);

    // 1. The Stone Body
    jellyShapes.push(
      <circle key={`stone-${key}`} cx={cx} cy={cy} r={r} fill={fillColor} />
    );

    // 2. Connections
    const rightPos = { row: s.row, col: s.col + 1 };
    const rightKey = posKey(rightPos);
    
    const downPos = { row: s.row + 1, col: s.col };
    const downKey = posKey(downPos);
    
    const diagKey = posKey({ row: s.row + 1, col: s.col + 1 });
    
    const hasRight = stoneSet.has(rightKey);
    const hasDown = stoneSet.has(downKey);

    // --- Horizontal Connection ---
    if (hasRight) {
        const isNew = isSamePos(s, lastMove) || isSamePos(rightPos, lastMove);
        const animClass = isNew ? 'animate-connect-h' : '';

        // A. The "Flesh" (Bridge for fusion)
        jellyShapes.push(
            <rect 
                key={`h-bridge-${key}`}
                x={cx} 
                y={cy - bridgeThickness / 2}
                width={cellSize} 
                height={bridgeThickness}
                fill={fillColor}
                className={animClass}
            />
        );

        // B. The "Qi" (Skeleton Line)
        // Drawn separately so it doesn't get blurred by the filter
        qiLines.push(
            <line 
                key={`h-line-${key}`}
                x1={cx} y1={cy}
                x2={cx + cellSize} y2={cy}
                stroke={qiLineColor}
                strokeWidth={cellSize * 0.1}
                strokeLinecap="round"
                // Optional: apply simple fade-in if it's new, but keep it subtle
                style={{ opacity: isNew ? 0 : 1, animation: isNew ? 'fade-in 0.5s forwards 0.2s' : 'none' }}
            />
        );
    }

    // --- Vertical Connection ---
    if (hasDown) {
        const isNew = isSamePos(s, lastMove) || isSamePos(downPos, lastMove);
        const animClass = isNew ? 'animate-connect-v' : '';

        // A. The "Flesh" (Bridge for fusion)
        jellyShapes.push(
            <rect 
                key={`v-bridge-${key}`}
                x={cx - bridgeThickness / 2} 
                y={cy}
                width={bridgeThickness} 
                height={cellSize}
                fill={fillColor}
                className={animClass}
            />
        );

        // B. The "Qi" (Skeleton Line)
        qiLines.push(
            <line 
                key={`v-line-${key}`}
                x1={cx} y1={cy}
                x2={cx} y2={cy + cellSize}
                stroke={qiLineColor}
                strokeWidth={cellSize * 0.1}
                strokeLinecap="round"
                style={{ opacity: isNew ? 0 : 1, animation: isNew ? 'fade-in 0.5s forwards 0.2s' : 'none' }}
            />
        );
    }

    // --- 2x2 Gap Filler ---
    if (hasRight && hasDown && stoneSet.has(diagKey)) {
        const gapSize = cellSize * 0.5;
        jellyShapes.push(
            <rect 
                key={`gap-${key}`}
                x={cx} y={cy}
                width={gapSize} height={gapSize}
                fill={fillColor}
            />
        );
    }
  });

  return (
    <g>
        {/* Layer 1: The organic fused shape (The "Flesh") */}
        <g filter="url(#gooey-stone)">
            {jellyShapes}
        </g>
        
        {/* Layer 2: The internal connection lines (The "Qi" / Skeleton) */}
        {/* Rendered on top, crisp and sharp */}
        <g pointerEvents="none">
            {qiLines}
        </g>
    </g>
  );
};
