import React from 'react';
import { StoneGroup, Player } from '../types';

interface JellyGroupProps {
  group: StoneGroup;
  cellSize: number;
}

const JellyGroup: React.FC<JellyGroupProps> = ({ group, cellSize }) => {
  const isBlack = group.player === Player.Black;
  const fillColor = isBlack ? '#333333' : '#ffffff';
  const textColor = isBlack ? '#ffffff' : '#000000';
  const shadowColor = 'rgba(0,0,0,0.2)';

  // Find leader for expression placement
  const leader = group.stones[0]; // Already sorted in engine

  // Generate paths/shapes
  // We use a set of circles and rects. Because they have the same fill, they merge visually.
  const shapes = group.stones.map((s, idx) => {
    const x = (s.col + 1) * cellSize;
    const y = (s.row + 1) * cellSize;
    const r = cellSize * 0.45;
    
    const elements = [];

    // The main circle
    elements.push(
      <circle key={`c-${idx}`} cx={x} cy={y} r={r} />
    );

    // Connection right
    // Check if there is a stone in this group at (row, col+1)
    if (group.stones.some(other => other.row === s.row && other.col === s.col + 1)) {
        elements.push(
            <rect 
                key={`r-h-${idx}`} 
                x={x} 
                y={y - r} 
                width={cellSize} 
                height={r * 2} 
            />
        );
    }

    // Connection down
    // Check if there is a stone in this group at (row+1, col)
    if (group.stones.some(other => other.row === s.row + 1 && other.col === s.col)) {
        elements.push(
            <rect 
                key={`r-v-${idx}`} 
                x={x - r} 
                y={y} 
                width={r * 2} 
                height={cellSize} 
            />
        );
    }

    return elements;
  });

  return (
    <g>
      {/* Shadow Layer (shifted slightly) */}
      <g fill={shadowColor} transform="translate(0, 2)">
         {shapes}
      </g>
      
      {/* Main Color Layer */}
      <g fill={fillColor}>
         {shapes}
      </g>

      {/* Expression on the leader stone */}
      <text
        x={(leader.col + 1) * cellSize}
        y={(leader.row + 1) * cellSize}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textColor}
        fontSize={cellSize * 0.2}
        fontWeight="bold"
        className="pointer-events-none select-none font-bold"
        style={{ textShadow: isBlack ? '0px 1px 2px rgba(0,0,0,0.5)' : 'none' }}
      >
        {group.expression}
      </text>
    </g>
  );
};

export default JellyGroup;