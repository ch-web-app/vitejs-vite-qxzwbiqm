
import React, { useMemo } from 'react';
import { BoardState, Player, Position, ScoredMove, posKey, GameMode, isSamePos, keyToPos } from '../types';
import { JellyLayer } from './JellyGroup';
import { getAllGroups } from '../services/goLogic';

interface GoBoardProps {
  size: number;
  board: BoardState;
  onPlaceStone: (pos: Position) => void;
  currentPlayer: Player;
  isThinking: boolean;
  gameMode: GameMode | null;
  lastMove: Position | null;
  aiCandidates?: ScoredMove[];
  isReviewMode?: boolean;
}

export const GoBoard: React.FC<GoBoardProps> = ({ 
  size, 
  board, 
  onPlaceStone, 
  currentPlayer, 
  isThinking, 
  gameMode, 
  lastMove,
  aiCandidates = [],
  isReviewMode = false
}) => {
  const cellSize = 40;
  const boardSizePx = (size + 1) * cellSize;

  const starPoints = useMemo(() => {
    const points: Position[] = [];
    if (size === 19) {
      [3, 9, 15].forEach(r => [3, 9, 15].forEach(c => points.push({ row: r, col: c })));
    } else if (size === 13) {
      [3, 6, 9].forEach(r => [3, 6, 9].forEach(c => points.push({ row: r, col: c })));
    } else if (size === 9) {
      [2, 6].forEach(r => [2, 6].forEach(c => points.push({ row: r, col: c })));
      points.push({ row: 4, col: 4 });
    }
    return points;
  }, [size]);

  const blackStones: Position[] = [];
  const whiteStones: Position[] = [];
  board.forEach((player, key) => {
    const [row, col] = key.split(',').map(Number);
    if (player === Player.Black) blackStones.push({ row, col });
    else whiteStones.push({ row, col });
  });

  // Calculate liberty points for review mode
  const libertyMarkers = useMemo(() => {
    if (!isReviewMode) return [];
    
    const groups = getAllGroups(board, size);
    const markers: React.ReactElement[] = [];
    const processedLibs = new Set<string>();

    groups.forEach(group => {
        group.liberties.forEach(lib => {
            const k = posKey(lib);
            // Avoid drawing multiple dots on the same intersection if shared by groups
            // However, visually simple is better. 
            if (!processedLibs.has(k)) {
                processedLibs.add(k);
                 markers.push(
                    <circle 
                        key={`lib-${k}`}
                        cx={(lib.col + 1) * cellSize}
                        cy={(lib.row + 1) * cellSize}
                        r={cellSize * 0.12}
                        fill="#EF4444" // Red-500
                        opacity={0.6}
                        className="animate-pulse"
                    />
                 );
            }
        });
    });
    return markers;
  }, [board, size, isReviewMode, cellSize]);

  const handleBoardClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isThinking) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = boardSizePx / rect.width;
    const scaleY = boardSizePx / rect.height;
    
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Use round to find nearest intersection
    const col = Math.round(clickX / cellSize) - 1;
    const row = Math.round(clickY / cellSize) - 1;

    if (row >= 0 && row < size && col >= 0 && col < size) {
      onPlaceStone({ row, col });
    }
  };

  return (
    <div className="relative shadow-2xl rounded-sm bg-[#DCB35C]" style={{ width: '100%', maxWidth: '600px', aspectRatio: '1/1' }}>
      <svg
        viewBox={`0 0 ${boardSizePx} ${boardSizePx}`}
        className="w-full h-full cursor-pointer touch-none"
        onClick={handleBoardClick}
      >
        <defs>
            <filter id="jelly-goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
                <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
            </filter>
        </defs>

        {/* Board Texture/Background */}
        <rect x="0" y="0" width={boardSizePx} height={boardSizePx} fill="#DCB35C" />

        {/* Grid Lines */}
        <g stroke="#403015" strokeWidth="1.5" strokeLinecap="round">
            {Array.from({ length: size }).map((_, i) => (
                <React.Fragment key={i}>
                    <line x1={cellSize} y1={(i + 1) * cellSize} x2={size * cellSize} y2={(i + 1) * cellSize} />
                    <line x1={(i + 1) * cellSize} y1={cellSize} x2={(i + 1) * cellSize} y2={size * cellSize} />
                </React.Fragment>
            ))}
        </g>

        {/* Star Points */}
        <g fill="#403015">
            {starPoints.map((p, i) => (
                <circle key={i} cx={(p.col + 1) * cellSize} cy={(p.row + 1) * cellSize} r={4} />
            ))}
        </g>

        {/* Liberty Markers (Review Mode) */}
        {isReviewMode && (
            <g style={{ pointerEvents: 'none' }}>
                {libertyMarkers}
            </g>
        )}

        {/* Stones */}
        <JellyLayer stones={blackStones} color={Player.Black} cellSize={cellSize} lastMove={lastMove} board={board} size={size} />
        <JellyLayer stones={whiteStones} color={Player.White} cellSize={cellSize} lastMove={lastMove} board={board} size={size} />

        {/* Last Move Indicator */}
        {lastMove && (
            <circle 
                cx={(lastMove.col + 1) * cellSize} 
                cy={(lastMove.row + 1) * cellSize} 
                r={cellSize * 0.08} 
                fill={board.get(posKey(lastMove)) === Player.Black ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)"}
                style={{ pointerEvents: 'none' }}
            />
        )}

        {/* AI Candidates (Display Priority 1-5) - Hide in Review Mode */}
        {!isReviewMode && aiCandidates.map((c, i) => (
            <g key={i}>
                 <circle 
                    cx={(c.pos.col + 1) * cellSize} 
                    cy={(c.pos.row + 1) * cellSize} 
                    r={cellSize * 0.35} 
                    fill="rgba(255, 255, 255, 0.85)" 
                    stroke="#2563EB" 
                    strokeWidth={i === 0 ? "3" : "2"} // Emphasize the #1 choice
                 />
                 <text 
                    x={(c.pos.col + 1) * cellSize} 
                    y={(c.pos.row + 1) * cellSize} 
                    dy="0.35em" 
                    textAnchor="middle" 
                    fontSize={cellSize * 0.45} 
                    fill="#1D4ED8" 
                    fontWeight="900"
                    style={{ pointerEvents: 'none' }}
                 >
                    {i + 1}
                 </text>
            </g>
        ))}
      </svg>
    </div>
  );
};
