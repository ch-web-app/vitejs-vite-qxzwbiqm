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
  
  // Bridge thickness: Thinner than the stone to create the "neck" effect
  const bridgeThickness = cellSize * 0.45;

  const fillColor = player === Player.Black ? "#4b5563" : "#ffffff"; // Darker grey for black stones
  
  const jellyShapes: React.ReactElement[] = [];

  stones.forEach(s => {
    const cx = (s.col + 1) * cellSize;
    const cy = (s.row + 1) * cellSize;
    const key = posKey(s);

    // 1. The Stone
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

        // Rect spans from center to center. Width = cellSize.
        // It is vertically centered at `cy`.
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
    }

    // --- Vertical Connection ---
    if (hasDown) {
        const isNew = isSamePos(s, lastMove) || isSamePos(downPos, lastMove);
        const animClass = isNew ? 'animate-connect-v' : '';

        // Rect spans from center to center. Height = cellSize.
        // It is horizontally centered at `cx`.
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
    }

    // --- 2x2 Gap Filler ---
    // With the gooey filter, the gap usually fills itself if the blur is high enough,
    // but adding a small filler ensures it doesn't look like a donut.
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
    // Apply the Gooey filter to the entire group
    <g filter="url(#gooey-stone)">
        {jellyShapes}
    </g>
  );
};
