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
  // Slightly reduced radius (0.43) to accommodate the border thickness
  const r = cellSize * 0.43;
  
  let pathD = "";
  const connections: React.ReactElement[] = [];

  stones.forEach(s => {
    const cx = (s.col + 1) * cellSize;
    const cy = (s.row + 1) * cellSize;
    
    // 1. Body (Circle)
    pathD += `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} `;
    
    // 2. Connections Logic & Path Building
    const rightPos = { row: s.row, col: s.col + 1 };
    const rightKey = posKey(rightPos);
    
    const downPos = { row: s.row + 1, col: s.col };
    const downKey = posKey(downPos);
    
    const diagKey = posKey({ row: s.row + 1, col: s.col + 1 });
    
    const hasRight = stoneSet.has(rightKey);
    const hasDown = stoneSet.has(downKey);

    // Right connection (Rect Path)
    if (hasRight) {
      pathD += `M ${cx} ${cy - r} L ${cx + cellSize} ${cy - r} L ${cx + cellSize} ${cy + r} L ${cx} ${cy + r} Z `;
    }

    // Down connection (Rect Path)
    if (hasDown) {
      pathD += `M ${cx - r} ${cy} L ${cx + r} ${cy} L ${cx + r} ${cy + cellSize} L ${cx - r} ${cy + cellSize} Z `;
    }

    // 2x2 Gap Filler
    if (hasRight && hasDown && stoneSet.has(diagKey)) {
        const gapSize = cellSize * 0.6;
        const offset = -1; 
        pathD += `M ${cx + offset} ${cy + offset} L ${cx + gapSize} ${cy + offset} L ${cx + gapSize} ${cy + gapSize} L ${cx + offset} ${cy + gapSize} Z `;
    }

    // 3. Visual "Skeleton" Lines (Qi/Connection Lines)
    // We draw lines connecting the centers to show the internal structure
    // Check if this stone is newly placed OR if the neighbor is newly placed (to animate the link forming)
    const isSelfNew = isSamePos(s, lastMove);
    
    const lineColor = player === Player.Black ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)";

    if (hasRight) {
       const isRightNew = isSamePos(rightPos, lastMove);
       const shouldAnimate = isSelfNew || isRightNew;
       connections.push(
         <line 
            key={`h-${posKey(s)}`} 
            x1={cx} y1={cy} 
            x2={cx + cellSize} y2={cy} 
            stroke={lineColor} 
            strokeWidth={cellSize * 0.08}
            strokeLinecap="round"
            className={shouldAnimate ? "animate-draw" : ""}
         />
       );
    }

    if (hasDown) {
       const isDownNew = isSamePos(downPos, lastMove);
       const shouldAnimate = isSelfNew || isDownNew;
       connections.push(
         <line 
            key={`v-${posKey(s)}`} 
            x1={cx} y1={cy} 
            x2={cx} y2={cy + cellSize} 
            stroke={lineColor} 
            strokeWidth={cellSize * 0.08}
            strokeLinecap="round"
            className={shouldAnimate ? "animate-draw" : ""}
         />
       );
    }
  });

  const fillColor = player === Player.Black ? "#6b7280" : "#ffffff";
  
  // Is this group containing the last move? If so, we might want to pop the specific stone.
  // Actually, animating the entire path is glitchy, so we just render the path.
  // We use a separate <circle> overlay to handle the "Pop" of the specific stone
  // so the background jelly doesn't flicker.
  
  const newStoneOverlay = stones.map(s => {
     if (isSamePos(s, lastMove)) {
         const cx = (s.col + 1) * cellSize;
         const cy = (s.row + 1) * cellSize;
         return (
             <circle 
                key={`pop-${posKey(s)}`}
                cx={cx} cy={cy} r={r}
                fill={fillColor}
                className="animate-pop"
                style={{ filter: "brightness(1.1)" }} // Slight highlight for new stone
             />
         );
     }
     return null;
  });

  return (
    <g>
        {/* Base Jelly Layer */}
        <path 
          d={pathD} 
          fill={fillColor} 
          stroke="none"
          style={{ 
              filter: "url(#stone-border) drop-shadow(0px 3px 2px rgba(0,0,0,0.25))",
              transition: "d 0.3s ease" // Smooth morphing if supported
          }}
        />
        
        {/* Skeleton/Connection Lines Layer */}
        {connections}

        {/* Animation Overlay for the specific new stone */}
        {newStoneOverlay}
    </g>
  );
};
