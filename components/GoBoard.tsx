import React, { useMemo } from 'react';
import { BoardState, Position, Player, posKey, GameMode } from '../types';
import { getAllGroups } from '../services/goLogic';
import { JellyGroup } from './JellyGroup';

interface GoBoardProps {
  size: number;
  board: BoardState;
  onPlaceStone: (pos: Position) => void;
  currentPlayer: Player;
  isThinking: boolean;
  gameMode: GameMode;
  myPlayerType?: Player; // For online, am I black or white?
  lastMove?: Position | null;
}

export const GoBoard: React.FC<GoBoardProps> = ({ 
  size, board, onPlaceStone, currentPlayer, isThinking, gameMode, myPlayerType, lastMove 
}) => {
  // --- Expressions Constants ---
  const expNormal = "(•‿•)";
  const expDanger = "(>﹏<)";
  const expHappy = "(^ω^)";

  // --- Calculations ---
  
  // Calculate groups and expressions
  const { groups, expressions } = useMemo(() => {
    const allGroups = getAllGroups(board, size);
    const exprMap = new Map<string, string>(); // leaderPos -> expression

    allGroups.forEach(g => {
      const liberties = g.liberties.length;
      let face = expNormal;
      if (liberties === 1) face = expDanger;
      else if (liberties >= 4) face = expHappy;
      
      // Find "leader" (top-left most stone) to draw the face on
      const sortedStones = [...g.stones].sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      });
      if (sortedStones.length > 0) {
        exprMap.set(posKey(sortedStones[0]), face);
      }
    });

    return { groups: allGroups, expressions: exprMap };
  }, [board, size]);

  // Star points
  const starPoints = useMemo(() => {
    const pts: Position[] = [];
    if (size === 9) {
      pts.push({row: 2, col: 2}, {row: 2, col: 6}, {row: 6, col: 2}, {row: 6, col: 6}, {row: 4, col: 4});
    } else if (size === 13) {
      pts.push({row: 3, col: 3}, {row: 3, col: 9}, {row: 9, col: 3}, {row: 9, col: 9}, {row: 6, col: 6});
    } else if (size === 19) {
      const corners = [3, 9, 15];
      corners.forEach(r => corners.forEach(c => pts.push({row: r, col: c})));
    }
    return pts;
  }, [size]);

  // Dimensions
  const containerSize = 800; // virtual units
  const padding = 40;
  const gridSize = containerSize - (padding * 2);
  const cellSize = gridSize / (size + 1); 
  
  // Dynamic filter parameters based on cell size
  const blurRadius = cellSize * 0.12; 
  const strokeWidth = 2.5; // Fixed stroke width often looks cleaner, or use cellSize * 0.04

  const handleTap = (r: number, c: number) => {
    if (isThinking) return;
    
    // Online check
    if ((gameMode === GameMode.OnlineHost || gameMode === GameMode.OnlineJoin)) {
      if (myPlayerType && currentPlayer !== myPlayerType) return;
    }

    onPlaceStone({ row: r, col: c });
  };

  return (
    <div className="relative aspect-square w-full max-w-[600px] mx-auto select-none">
       {/* Background */}
       <div className="absolute inset-0 bg-[#E6CC9D] rounded-xl shadow-xl border-b-8 border-[#C9A66B]"></div>
       
       {/* Animation Styles */}
       <style>{`
         @keyframes grow-h {
            from { transform: scaleX(0); opacity: 0; }
            to { transform: scaleX(1); opacity: 1; }
         }
         @keyframes grow-v {
            from { transform: scaleY(0); opacity: 0; }
            to { transform: scaleY(1); opacity: 1; }
         }
         @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
         }
         .animate-connect-h {
            transform-box: fill-box;
            transform-origin: center;
            animation: grow-h 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
         }
         .animate-connect-v {
            transform-box: fill-box;
            transform-origin: center;
            animation: grow-v 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
         }
       `}</style>

       <svg 
         viewBox={`0 0 ${containerSize} ${containerSize}`} 
         className="absolute inset-0 w-full h-full"
       >
          <defs>
             {/* Gooey Filter for Organic Fusion */}
             <filter id="gooey-stone" x="-50%" y="-50%" width="200%" height="200%">
                {/* 1. Blur the input shapes to blend them */}
                <feGaussianBlur in="SourceGraphic" stdDeviation={blurRadius} result="blur" />
                
                {/* 2. Threshold alpha to sharpen the edges (create the blob) */}
                {/* The matrix 18 -7 sharpens the blur: alpha * 18 - 7 */}
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
                
                {/* 3. Create the black border outline */}
                <feMorphology in="goo" operator="dilate" radius={strokeWidth} result="thick" />
                <feFlood floodColor="black" result="black" />
                <feComposite in="black" in2="thick" operator="in" result="border_layer" />
                
                {/* 4. Merge Border behind the Goo shape */}
                <feMerge>
                   <feMergeNode in="border_layer" />
                   <feMergeNode in="goo" />
                </feMerge>
             </filter>
          </defs>

          {/* Grid Lines */}
          <g stroke="rgba(0,0,0,0.15)" strokeWidth="2" strokeLinecap="round">
            {Array.from({ length: size }).map((_, i) => {
               const pos = (i + 1) * cellSize;
               const len = (size) * cellSize; 
               return (
                 <React.Fragment key={i}>
                   <line x1={cellSize} y1={pos} x2={len} y2={pos} />
                   <line x1={pos} y1={cellSize} x2={pos} y2={len} />
                 </React.Fragment>
               );
            })}
          </g>

          {/* Star Points */}
          {starPoints.map((p, i) => (
            <circle 
              key={i}
              cx={(p.col + 1) * cellSize}
              cy={(p.row + 1) * cellSize}
              r={cellSize * 0.12}
              fill="rgba(0,0,0,0.4)"
            />
          ))}

          {/* Stones (Jelly Groups) */}
          {groups.map((group, i) => (
             <JellyGroup 
                key={i} 
                group={group} 
                cellSize={cellSize} 
                lastMove={lastMove}
             />
          ))}

          {/* Expressions */}
          {Array.from(expressions).map(([key, face]) => {
            const p = JSON.parse(`{"row":${key.split(',')[0]},"col":${key.split(',')[1]}}`);
            const cx = (p.col + 1) * cellSize;
            const cy = (p.row + 1) * cellSize;
            const player = board.get(key);
            
            return (
              <text 
                key={key}
                x={cx}
                y={cy}
                dy={cellSize * 0.1} 
                textAnchor="middle"
                fontSize={cellSize * 0.28}
                fontWeight="700"
                fill={player === Player.Black ? "white" : "#333"}
                style={{ 
                  pointerEvents: 'none', 
                  textShadow: '0px 1px 2px rgba(0,0,0,0.3)',
                  fontFamily: '"Nunito", sans-serif'
                }}
              >
                {face}
              </text>
            );
          })}

          {/* Interaction Layer (Invisible Rects) */}
          {Array.from({ length: size }).map((_, r) => 
            Array.from({ length: size }).map((_, c) => (
              <rect
                key={`${r}-${c}`}
                x={(c + 0.5) * cellSize}
                y={(r + 0.5) * cellSize}
                width={cellSize}
                height={cellSize}
                fill="transparent"
                onClick={() => handleTap(r, c)}
                className="cursor-pointer hover:fill-black/5 transition-colors"
              />
            ))
          )}
       </svg>
    </div>
  );
};
