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
  // Radius for the main stone circle
  const r = cellSize * 0.44;
  
  const fillColor = player === Player.Black ? "#6b7280" : "#ffffff";
  const lineColor = player === Player.Black ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)";

  const jellyShapes: React.ReactElement[] = [];
  const connectionLines: React.ReactElement[] = [];

  stones.forEach(s => {
    const cx = (s.col + 1) * cellSize;
    const cy = (s.row + 1) * cellSize;
    const key = posKey(s);

    // 1. The Stone (Always present, no pop animation)
    jellyShapes.push(
      <circle key={`stone-${key}`} cx={cx} cy={cy} r={r} fill={fillColor} />
    );

    // 2. Check connections to Right and Down to create bridges
    const rightPos = { row: s.row, col: s.col + 1 };
    const rightKey = posKey(rightPos);
    
    const downPos = { row: s.row + 1, col: s.col };
    const downKey = posKey(downPos);
    
    const diagKey = posKey({ row: s.row + 1, col: s.col + 1 });
    
    const hasRight = stoneSet.has(rightKey);
    const hasDown = stoneSet.has(downKey);

    // --- Horizontal Connection ---
    if (hasRight) {
        // Did this connection just happen?
        const isNew = isSamePos(s, lastMove) || isSamePos(rightPos, lastMove);
        const animClass = isNew ? 'animate-connect-h' : '';
        const lineAnimClass = isNew ? 'animate-line' : '';

        // The bridge shape (Rect)
        jellyShapes.push(
            <rect 
                key={`h-bridge-${key}`}
                x={cx} y={cy - r}
                width={cellSize} height={r * 2}
                fill={fillColor}
                className={animClass}
            />
        );

        // The "Qi" line (Skeleton)
        connectionLines.push(
            <line 
                key={`h-line-${key}`}
                x1={cx} y1={cy}
                x2={cx + cellSize} y2={cy}
                stroke={lineColor}
                strokeWidth={cellSize * 0.1}
                strokeLinecap="round"
                className={lineAnimClass}
            />
        );
    }

    // --- Vertical Connection ---
    if (hasDown) {
        // Did this connection just happen?
        const isNew = isSamePos(s, lastMove) || isSamePos(downPos, lastMove);
        const animClass = isNew ? 'animate-connect-v' : '';
        const lineAnimClass = isNew ? 'animate-line' : '';

        // The bridge shape (Rect)
        jellyShapes.push(
            <rect 
                key={`v-bridge-${key}`}
                x={cx - r} y={cy}
                width={r * 2} height={cellSize}
                fill={fillColor}
                className={animClass}
            />
        );

        // The "Qi" line (Skeleton)
        connectionLines.push(
            <line 
                key={`v-line-${key}`}
                x1={cx} y1={cy}
                x2={cx} y2={cy + cellSize}
                stroke={lineColor}
                strokeWidth={cellSize * 0.1}
                strokeLinecap="round"
                className={lineAnimClass}
            />
        );
    }

    // --- 2x2 Gap Filler (Small square in the center of 4 stones) ---
    if (hasRight && hasDown && stoneSet.has(diagKey)) {
        // This makes the corner of a 2x2 block look filled
        // It doesn't need special animation because the surrounding bridges animate
        const gapSize = cellSize * 0.6;
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
        {/* Render jelly shapes inside the filter group to merge them */}
        <g filter="url(#stone-border)">
            {jellyShapes}
        </g>
        
        {/* Render connection lines on top (sharp, no filter) */}
        {connectionLines}
    </g>
  );
};
