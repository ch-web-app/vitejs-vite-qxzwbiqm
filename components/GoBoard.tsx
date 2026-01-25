import React, { useMemo } from 'react';
import { BoardState, Position, Player, posKey, GameMode } from '../types';
import { getAllGroups } from '../services/goLogic';
import { JellyLayer } from './JellyGroup';

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
  
  // 1. Calculate Groups, Expressions, and Atari Points
  const { expressions, atariPoints, blackStones, whiteStones } = useMemo(() => {
    const allGroups = getAllGroups(board, size);
    const exprMap = new Map<string, string>(); // leaderPos -> expression
    const atariSet = new Set<string>(); // "row,col" of the liberty itself
    
    const b: Position[] = [];
    const w: Position[] = [];

    allGroups.forEach(g => {
      const liberties = g.liberties.length;
      let face = expNormal;
      
      if (liberties === 1) {
          face = expDanger;
          // Add the single liberty to atari set to show a warning marker
          if (g.liberties[0]) {
             atariSet.add(posKey(g.liberties[0]));
          }
      } else if (liberties >= 4) {
          face = expHappy;
      }
      
      // Separate stones for layers
      if (g.player === Player.Black) {
          g.stones.forEach(s => b.push(s));
      } else {
          g.stones.forEach(s => w.push(s));
      }
      
      // Find "leader" for face
      const sortedStones = [...g.stones].sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      });
      if (sortedStones.length > 0) {
        exprMap.set(posKey(sortedStones[0]), face);
      }
    });

    return { 
        expressions: exprMap, 
        atariPoints: atariSet,
        blackStones: b,
        whiteStones: w
    };
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
  const strokeWidth = 2.5; 

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
         @keyframes pulse-red {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
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
         .animate-atari {
            transform-box: fill-box;
            transform-origin: center;
            animation: pulse-red 1s infinite ease-in-out;
         }
       `}</style>

       <svg 
         viewBox={`0 0 ${containerSize} ${containerSize}`} 
         className="absolute inset-0 w-full h-full"
       >
          <defs>
             {/* Gooey Filter for Organic Fusion */}
             <filter id="gooey-stone" x="-50%" y="-50%" width="200%" height="200%">
                {/* 1. Blur to blend shapes */}
                <feGaussianBlur in="SourceGraphic" stdDeviation={blurRadius} result="blur" />
                
                {/* 2. Sharpen threshold to create organic edges */}
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
                
                {/* 3. Create black border */}
                <feMorphology in="goo" operator="dilate" radius={strokeWidth} result="thick" />
                <feFlood floodColor="black" result="black" />
                <feComposite in="black" in2="thick" operator="in" result="border_layer" />
                
                {/* 4. Merge */}
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

          {/* Atari Markers (Underneath stones if any, usually on empty spots) */}
          {Array.from(atariPoints).map(key => {
             const [r, c] = key.split(',').map(Number);
             const cx = (c + 1) * cellSize;
             const cy = (r + 1) * cellSize;
             const markerSize = cellSize * 0.25;
             return (
               <g key={`atari-${key}`} className="animate-atari">
                  {/* Draw a red X or warning circle */}
                  <circle cx={cx} cy={cy} r={markerSize} fill="rgba(239, 68, 68, 0.3)" />
                  <line x1={cx-markerSize/2} y1={cy-markerSize/2} x2={cx+markerSize/2} y2={cy+markerSize/2} stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                  <line x1={cx+markerSize/2} y1={cy-markerSize/2} x2={cx-markerSize/2} y2={cy+markerSize/2} stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
               </g>
             );
          })}

          {/* Render Layers (Black Stones & White Stones) */}
          <JellyLayer 
            stones={blackStones} 
            color={Player.Black} 
            cellSize={cellSize} 
            lastMove={lastMove} 
            board={board}
          />
          <JellyLayer 
            stones={whiteStones} 
            color={Player.White} 
            cellSize={cellSize} 
            lastMove={lastMove} 
            board={board}
          />

          {/* Expressions Overlay */}
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
