import React from 'react';
import { GroupInfo, Player, posKey } from '../types';

interface JellyGroupProps {
  group: GroupInfo;
  cellSize: number;
}

export const JellyGroup: React.FC<JellyGroupProps> = ({ group, cellSize }) => {
  const { stones, player } = group;
  
  // Calculate SVG Path
  // To ensure the shapes fuse correctly (nonzero fill rule), all subpaths must have the same winding order (Clockwise).
  // 1. Circle: Drawn as two arcs with sweep-flag=1 (Clockwise).
  // 2. Rects: Drawn TL -> TR -> BR -> BL (Clockwise).
  
  const stoneSet = new Set(stones.map(posKey));
  // Slightly reduced radius (0.43) to accommodate the border thickness
  const r = cellSize * 0.43;
  
  let pathD = "";

  stones.forEach(s => {
    const cx = (s.col + 1) * cellSize;
    const cy = (s.row + 1) * cellSize;
    
    // 1. Body (Circle)
    pathD += `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} `;
    
    // 2. Connections
    const rightKey = posKey({ row: s.row, col: s.col + 1 });
    const downKey = posKey({ row: s.row + 1, col: s.col });
    const diagKey = posKey({ row: s.row + 1, col: s.col + 1 });
    
    // Right connection (Rect)
    if (stoneSet.has(rightKey)) {
      pathD += `M ${cx} ${cy - r} L ${cx + cellSize} ${cy - r} L ${cx + cellSize} ${cy + r} L ${cx} ${cy + r} Z `;
    }

    // Down connection (Rect)
    if (stoneSet.has(downKey)) {
      pathD += `M ${cx - r} ${cy} L ${cx + r} ${cy} L ${cx + r} ${cy + cellSize} L ${cx - r} ${cy + cellSize} Z `;
    }

    // 2x2 Gap Filler
    if (stoneSet.has(rightKey) && stoneSet.has(downKey) && stoneSet.has(diagKey)) {
        const gapSize = cellSize * 0.6;
        const offset = -1; 
        pathD += `M ${cx + offset} ${cy + offset} L ${cx + gapSize} ${cy + offset} L ${cx + gapSize} ${cy + gapSize} L ${cx + offset} ${cy + gapSize} Z `;
    }
  });

  // Updated Colors: Black -> Grey (#6b7280), White -> White (#ffffff)
  const fillColor = player === Player.Black ? "#6b7280" : "#ffffff";
  
  // We use the SVG filter #stone-border defined in GoBoard.tsx to create the outline.
  // We also use CSS filter for the drop shadow to give depth.
  return (
    <path 
      d={pathD} 
      fill={fillColor} 
      stroke="none"
      style={{ 
          filter: "url(#stone-border) drop-shadow(0px 3px 2px rgba(0,0,0,0.25))" 
      }}
    />
  );
};