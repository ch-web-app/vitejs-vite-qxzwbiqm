
import React, { useMemo } from 'react';
import { Player, Position, posKey, isSamePos, BoardState, keyToPos } from '../types';
import { getGroupAndLiberties } from '../services/goLogic';

interface JellyLayerProps {
  stones: Position[];
  color: Player;
  cellSize: number;
  lastMove?: Position | null;
  board: BoardState;
  isMask?: boolean;
  size: number;
}

const hasPos = (set: Set<string>, r: number, c: number) => set.has(`${r},${c}`);

// Helper to find connected components within the stones of this specific color
const findClusters = (stones: Position[]): Position[][] => {
  const visited = new Set<string>();
  const clusters: Position[][] = [];
  const stoneSet = new Set(stones.map(posKey));

  stones.forEach(startNode => {
    const key = posKey(startNode);
    if (visited.has(key)) return;

    const cluster: Position[] = [];
    const queue: Position[] = [startNode];
    visited.add(key);
    cluster.push(startNode);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = [
        { row: curr.row - 1, col: curr.col },
        { row: curr.row + 1, col: curr.col },
        { row: curr.row, col: curr.col - 1 },
        { row: curr.row, col: curr.col + 1 },
      ];

      neighbors.forEach(n => {
        const nKey = posKey(n);
        if (stoneSet.has(nKey) && !visited.has(nKey)) {
          visited.add(nKey);
          cluster.push(n);
          queue.push(n);
        }
      });
    }
    clusters.push(cluster);
  });
  return clusters;
};

export const JellyLayer: React.FC<JellyLayerProps> = ({ stones, color, cellSize, lastMove, board, isMask, size }) => {
  const stoneSet = new Set<string>(stones.map(posKey));
  
  const r = cellSize * 0.46; 
  const thickBridge = cellSize * 0.48; // Thick positive connection for fusion
  const thinLink = cellSize * 0.22;   // Diagonal ligaments

  const fillColor = isMask ? "white" : (color === Player.Black ? "#2D3748" : "#EDF2F7"); 
  const textColor = color === Player.Black ? "rgba(255,255,255,0.95)" : "rgba(40,40,40,0.85)";
  
  const stoneElements: React.ReactElement[] = [];
  const connectionElements: React.ReactElement[] = [];
  const faceElements: React.ReactElement[] = [];

  // 1. Calculate Expressions (One per group)
  // We identify visual clusters first, then find the "Center of Mass" for each cluster.
  const facesToRender = useMemo(() => {
    const map = new Map<string, string>(); // stoneKey -> expression
    if (isMask) return map;

    const clusters = findClusters(stones);

    clusters.forEach(cluster => {
        if (cluster.length === 0) return;

        // Calculate Average Position (Center of Mass)
        let sumR = 0, sumC = 0;
        cluster.forEach(p => { sumR += p.row; sumC += p.col; });
        const avgR = sumR / cluster.length;
        const avgC = sumC / cluster.length;

        // Find stone closest to center
        let closestStone = cluster[0];
        let minDist = Number.MAX_VALUE;
        
        cluster.forEach(p => {
            const dist = Math.pow(p.row - avgR, 2) + Math.pow(p.col - avgC, 2);
            if (dist < minDist) {
                minDist = dist;
                closestStone = p;
            }
        });

        // Calculate liberties for this specific group using game logic
        const groupInfo = getGroupAndLiberties(board, size, closestStone);
        const libs = groupInfo.liberties.length;

        let expression = '';
        
        // Unified expressions for both Black and White (3 expressions total)
        if (libs <= 1) {
            expression = 'x _ x';       // Danger (Atari)
        } else if (libs === 2) {
            expression = 'ò _ ó';       // Warning (Angry/Serious)
        } else {
            expression = '• ‿ •';       // Happy (Safe)
        }

        if (expression) {
            map.set(posKey(closestStone), expression);
        }
    });

    return map;
  }, [stones, board, size, isMask, color]);

  stones.forEach(s => {
    const cx = (s.col + 1) * cellSize;
    const cy = (s.row + 1) * cellSize;
    const key = posKey(s);
    
    const hasRight = hasPos(stoneSet, s.row, s.col + 1);
    const hasDown = hasPos(stoneSet, s.row + 1, s.col);
    const hasDownRight = hasPos(stoneSet, s.row + 1, s.col + 1);
    const hasDownLeft = hasPos(stoneSet, s.row + 1, s.col - 1);

    const isThisNew = isSamePos(s, lastMove);

    // Stone Body
    stoneElements.push(
      <circle 
        key={`stone-${key}`} 
        cx={cx} cy={cy} r={r} 
        fill={fillColor} 
        className={`transition-all duration-700 ${isThisNew ? 'animate-stone-pop' : ''}`}
        style={{ 
          transformOrigin: `${cx}px ${cy}px`,
        }}
      />
    );

    // Expression (Only if this is the chosen "Face Stone" for the group)
    if (!isMask && facesToRender.has(key)) {
        faceElements.push(
            <text 
                key={`face-${key}`}
                x={cx} y={cy}
                dy=".38em"
                textAnchor="middle"
                fill={textColor}
                fontSize={cellSize * 0.34} 
                fontWeight="900"
                className="animate-stone-pop"
                style={{ pointerEvents: 'none', fontFamily: '"Nunito", sans-serif', letterSpacing: '-0.05em' }}
            >
                {facesToRender.get(key)}
            </text>
        );
    }

    // Connections with Soft Animation (animate-bridge-grow)
    if (hasRight) {
        connectionElements.push(
            <rect 
                key={`h-bridge-${key}`}
                x={cx} y={cy - thickBridge / 2}
                width={cellSize} height={thickBridge}
                fill={fillColor}
                className="animate-bridge-grow"
            />
        );
    }
    if (hasDown) {
        connectionElements.push(
            <rect 
                key={`v-bridge-${key}`}
                x={cx - thickBridge / 2} y={cy}
                width={thickBridge} height={cellSize}
                fill={fillColor}
                className="animate-bridge-grow"
            />
        );
    }

    // Diagonal Connections
    const diagLen = Math.sqrt(2) * cellSize;

    if (hasDownRight) {
        const drBlocked = board.has(posKey({row: s.row, col: s.col + 1})) || board.has(posKey({row: s.row + 1, col: s.col}));
        connectionElements.push(
            <line 
                key={`diag-dr-${key}`}
                x1={cx} y1={cy}
                x2={cx + cellSize} y2={cy + cellSize}
                stroke={fillColor}
                strokeWidth={thinLink}
                strokeLinecap="round"
                className="animate-bridge-grow"
                style={{
                    opacity: drBlocked ? 0 : 1,
                    strokeDasharray: diagLen,
                    strokeDashoffset: drBlocked ? diagLen : 0,
                    transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s'
                } as React.CSSProperties}
            />
        );
    }

    if (hasDownLeft) {
        const dlBlocked = board.has(posKey({row: s.row, col: s.col - 1})) || board.has(posKey({row: s.row + 1, col: s.col}));
        connectionElements.push(
            <line 
                key={`diag-dl-${key}`}
                x1={cx} y1={cy}
                x2={cx - cellSize} y2={cy + cellSize}
                stroke={fillColor}
                strokeWidth={thinLink}
                strokeLinecap="round"
                className="animate-bridge-grow"
                style={{
                    opacity: dlBlocked ? 0 : 1,
                    strokeDasharray: diagLen,
                    strokeDashoffset: dlBlocked ? diagLen : 0,
                    transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s'
                } as React.CSSProperties}
            />
        );
    }
  });

  return (
    <>
        <g filter="url(#jelly-goo)">
            {connectionElements}
            {stoneElements}
        </g>
        <g>
            {faceElements}
        </g>
    </>
  );
};
