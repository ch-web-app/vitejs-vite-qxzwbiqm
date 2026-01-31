
import { BoardState, Player, Position, posKey, keyToPos, GroupInfo, AiLevel, isSamePos, ScoredMove, BoardHistory } from '../types';
import { OPENING_BOOKS } from './openingData';

// Helper: Check if two board states are identical
export const areBoardsEqual = (b1: BoardState, b2: BoardState): boolean => {
  if (b1.size !== b2.size) return false;
  for (const [key, val] of b1) {
    if (b2.get(key) !== val) return false;
  }
  return true;
};

export const getGroupAndLiberties = (board: BoardState, size: number, startPos: Position): GroupInfo => {
  const startKey = posKey(startPos);
  const player = board.get(startKey);
  
  if (!player) {
    return { stones: [], liberties: [], player: Player.Black };
  }

  const stones = new Set<string>();
  const liberties = new Set<string>();
  const queue: Position[] = [startPos];
  stones.add(startKey);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = [
      { row: curr.row - 1, col: curr.col },
      { row: curr.row + 1, col: curr.col },
      { row: curr.row, col: curr.col - 1 },
      { row: curr.row, col: curr.col + 1 },
    ];

    for (const next of neighbors) {
      if (next.row >= 0 && next.row < size && next.col >= 0 && next.col < size) {
        const nextKey = posKey(next);
        const nextPlayer = board.get(nextKey);

        if (nextPlayer === player) {
          if (!stones.has(nextKey)) {
            stones.add(nextKey);
            queue.push(next);
          }
        } else if (nextPlayer === undefined) {
          liberties.add(nextKey);
        }
      }
    }
  }

  return {
    stones: Array.from(stones).map(keyToPos),
    liberties: Array.from(liberties).map(keyToPos),
    player
  };
};

export const getAllGroups = (board: BoardState, size: number): GroupInfo[] => {
  const groups: GroupInfo[] = [];
  const visited = new Set<string>();

  board.forEach((player, key) => {
    if (!visited.has(key)) {
      const pos = keyToPos(key);
      const info = getGroupAndLiberties(board, size, pos);
      groups.push(info);
      info.stones.forEach(s => visited.add(posKey(s)));
    }
  });

  return groups;
};

export const analyzeTerritory = (board: BoardState, size: number) => {
  const territoryMap = new Map<string, Player | 'Neutral'>();
  const visited = new Set<string>();

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const pos = { row: r, col: c };
      const key = posKey(pos);
      if (board.has(key) || visited.has(key)) continue;

      const region = new Set<string>();
      const queue: Position[] = [pos];
      const borderPlayers = new Set<Player>();
      region.add(key);
      visited.add(key);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const neighbors = [
          { row: curr.row - 1, col: curr.col },
          { row: curr.row + 1, col: curr.col },
          { row: curr.row, col: curr.col - 1 },
          { row: curr.row, col: curr.col + 1 },
        ];

        for (const next of neighbors) {
          if (next.row >= 0 && next.row < size && next.col >= 0 && next.col < size) {
            const nextKey = posKey(next);
            const p = board.get(nextKey);
            if (p) {
              borderPlayers.add(p);
            } else if (!visited.has(nextKey)) {
              visited.add(nextKey);
              region.add(nextKey);
              queue.push(next);
            }
          }
        }
      }

      const owner = borderPlayers.size === 1 ? Array.from(borderPlayers)[0] : 'Neutral';
      region.forEach(k => territoryMap.set(k, owner));
    }
  }

  return territoryMap;
};

export const generateLocalAnalysis = (
  winner: Player | 'Draw', 
  bTotal: number, 
  wTotal: number, 
  board: BoardState, 
  size: number
): string => {
  if (winner === 'Draw') return "棋逢对手，双方在棋盘上平分秋色。";
  const diff = Math.abs(bTotal - wTotal);
  const winnerName = winner === Player.Black ? "黑棋" : "白棋";
  return `${winnerName} 最终以 ${diff.toFixed(1)} 目的优势胜出。本局棋在活棋保障和领地经营上展现了较高的水准。`;
};

const getStrategicValue = (r: number, c: number, size: number, moveCount: number): number => {
  const dr = Math.min(r, size - 1 - r);
  const dc = Math.min(c, size - 1 - c);
  
  // 布局期优先占据星位和小目
  if (moveCount < 20) {
    if (dr === 3 && dc === 3) return 8000;
    if ((dr === 2 && dc === 3) || (dr === 3 && dc === 2)) return 7500;
  }

  // 三线和四线是增地的黄金线
  if (dr === 2 || dc === 2) return 3000;
  if (dr === 3 || dc === 3) return 2500;

  // 严禁走一线（除非收官或生死关头）
  // 这里的负分会在后续逻辑中被救子/提子的超高分覆盖，所以只有纯废棋才会受此惩罚
  if (dr === 0 || dc === 0) return moveCount < (size * size * 0.8) ? -5000 : 500;
  
  return 200;
};

export const executeMove = (
  currentBoard: BoardState, 
  size: number, 
  pos: Position, 
  player: Player,
  previousBoard: BoardState | null = null // Ko rule: need to know the state before the current turn
): { newBoard: BoardState, captured: boolean, valid: boolean, capturedStones: number } => {
  const key = posKey(pos);
  if (currentBoard.has(key)) return { newBoard: currentBoard, captured: false, valid: false, capturedStones: 0 };

  const nextBoard = new Map(currentBoard);
  nextBoard.set(key, player);

  const opponent = player === Player.Black ? Player.White : Player.Black;
  let totalCaptured = 0;
  const neighbors = [[-1,0],[1,0],[0,-1],[0,1]];

  neighbors.forEach(([dr, dc]) => {
    const nr = pos.row + dr, nc = pos.col + dc;
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      const nKey = posKey({row:nr, col:nc});
      if (nextBoard.get(nKey) === opponent) {
        const g = getGroupAndLiberties(nextBoard, size, {row:nr, col:nc});
        if (g.liberties.length === 0) {
          totalCaptured += g.stones.length;
          g.stones.forEach(s => nextBoard.delete(posKey(s)));
        }
      }
    }
  });

  const myGroup = getGroupAndLiberties(nextBoard, size, pos);
  
  // Suicide rule: No liberties after move (and no captures made)
  if (myGroup.liberties.length === 0) return { newBoard: currentBoard, captured: false, valid: false, capturedStones: 0 };

  // Ko rule: The new board state cannot be identical to the previous board state (immediate recapture)
  if (previousBoard && areBoardsEqual(nextBoard, previousBoard)) {
     return { newBoard: currentBoard, captured: false, valid: false, capturedStones: 0 };
  }

  return { newBoard: nextBoard, captured: totalCaptured > 0, valid: true, capturedStones: totalCaptured };
};

// Helper to extract moves from history
const getMoveSequence = (history: BoardHistory[]): Position[] => {
  // history[0] contains the board AFTER move 1.
  // history[i].lastMove is the move that created that board state.
  return history.map(h => h.lastMove).filter((m): m is Position => m !== null);
};

export const getAIThinkingMove = (
  board: BoardState, 
  size: number, 
  level: AiLevel = AiLevel.Medium, 
  lastMove: Position | null = null,
  player: Player = Player.White,
  previousBoard: BoardState | null = null,
  history: BoardHistory[] = []
): { move: Position | null, candidates: ScoredMove[] } => {
  
  // --- Opening Book Logic for Easy/Medium ---
  if ((level === AiLevel.Easy || level === AiLevel.Medium) && history.length < 20) {
    const currentMoves = getMoveSequence(history);
    const moveIndex = currentMoves.length; // 0 for first move, 1 for second...

    // Find books that match the current sequence exactly
    const matchingBooks = OPENING_BOOKS.filter(book => {
      if (book.size !== size) return false;
      if (book.moves.length <= moveIndex) return false; // End of book
      
      // Check all previous moves
      for (let i = 0; i < moveIndex; i++) {
        if (!isSamePos(book.moves[i], currentMoves[i])) return false;
      }
      return true;
    });

    if (matchingBooks.length > 0) {
      // Pick a random matching book
      const randomBook = matchingBooks[Math.floor(Math.random() * matchingBooks.length)];
      const bookMove = randomBook.moves[moveIndex];
      
      // Double check validity (e.g. if board is somehow different despite history match)
      const validCheck = executeMove(board, size, bookMove, player, previousBoard);
      if (validCheck.valid) {
        return { 
          move: bookMove, 
          candidates: [{ pos: bookMove, score: 99999 }] // High score for display
        };
      }
    }
  }

  const opponent = player === Player.Black ? Player.White : Player.Black;
  const currentTerritory = analyzeTerritory(board, size);
  
  const poi = new Set<string>();
  // 增加全局视野：在布局期考虑所有空位
  if (board.size < 20) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!board.has(posKey({row:r, col:c}))) poi.add(posKey({row:r, col:c}));
      }
    }
  } else {
    // 战斗期关注局部及边缘
    board.forEach((_, key) => {
        const p = keyToPos(key);
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                const nr = p.row + dr, nc = p.col + dc;
                if (nr >= 0 && nr < size && nc >= 0 && nc < size) poi.add(posKey({row:nr, col:nc}));
            }
        }
    });
  }

  const candidateMoves: ScoredMove[] = [];
  const initialGroups = getAllGroups(board, size);

  poi.forEach(k => {
    const p = keyToPos(k);
    if (board.has(k)) return;
    
    // Check validity including Ko rule
    const moveRes = executeMove(board, size, p, player, previousBoard);
    if (!moveRes.valid) return;

    let score = 0;

    // --- 1. 生死与安全 (权重最高) ---
    // 围棋格言：先活后地。必须优先处理只有1-2气的弱棋。

    const newGroup = getGroupAndLiberties(moveRes.newBoard, size, p);
    const newLibs = newGroup.liberties.length;

    // A. 提子 (进攻)
    if (moveRes.captured) {
        score += 50000 + (moveRes.capturedStones * 5000);
    }

    // B. 自杀式填眼/送吃 (防守)
    if (newLibs === 1) {
        // 除非是打劫或提子，否则极力避免只有1口气的棋
        if (!moveRes.captured) {
             score -= 40000;
        }
    } else if (newLibs === 2) {
        // 只有2口气，属于不安定状态，除非是为了救更大的棋，否则慎重
        score -= 2000; 
    }

    // C. 救援与连接 (关键防御)
    // 检查此步是否连接了己方的弱棋 (气<=2)
    const neighbors = [[-1,0],[1,0],[0,-1],[0,1]];
    let connectedWeakGroup = false;

    neighbors.forEach(([dr, dc]) => {
        const nr = p.row + dr, nc = p.col + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
            const nKey = posKey({row:nr, col:nc});
            const neighborPlayer = board.get(nKey);
            
            if (neighborPlayer === player) {
                // 找到原棋盘上的这个邻居属于哪个群组
                const group = initialGroups.find(g => g.stones.some(s => s.row === nr && s.col === nc));
                if (group) {
                    if (group.liberties.length === 1) {
                        // 救援：邻居处于叫吃状态
                        if (newLibs > 1) {
                            score += 60000; // 救命棋！权重极高
                            connectedWeakGroup = true;
                        } else {
                            // 连上了还是只有1口气 (愚形送吃)
                            score -= 10000;
                        }
                    } else if (group.liberties.length === 2) {
                        // 加固：邻居只有2口气
                        if (newLibs > 2) {
                            score += 15000; // 显著增强，优于占星位
                            connectedWeakGroup = true;
                        }
                    }
                }
            } else if (neighborPlayer === opponent) {
                // D. 紧气/叫吃 (进攻)
                const group = initialGroups.find(g => g.stones.some(s => s.row === nr && s.col === nc));
                if (group) {
                     // 如果对方有2口气，我们填掉一口，让他变1口气 (叫吃)
                     if (group.liberties.length === 2 && group.liberties.some(l => l.row === p.row && l.col === p.col)) {
                         score += 18000; // 叫吃价值极高
                     }
                }
            }
        }
    });

    // --- 2. 棋形与眼位 (中等权重) ---
    
    // 虎口检测 (对角线有己方棋子，且旁边有己方棋子支撑)
    let diagFriendlies = 0;
    const diags = [[-1,-1],[-1,1],[1,-1],[1,1]];
    diags.forEach(([dr, dc]) => {
         const nr = p.row + dr, nc = p.col + dc;
         if (nr >=0 && nr < size && nc >=0 && nc < size) {
             if (board.get(posKey({row:nr, col:nc})) === player) diagFriendlies++;
         }
    });
    
    if (diagFriendlies >= 2 && newLibs >= 3) {
        score += 3000; // 良好的棋形
    }

    // 眼位判断：不要填自己的真眼
    let adjFriendlies = 0;
    neighbors.forEach(([dr, dc]) => {
         const nr = p.row + dr, nc = p.col + dc;
         if (nr >=0 && nr < size && nc >=0 && nc < size && board.get(posKey({row:nr, col:nc})) === player) {
             adjFriendlies++;
         }
    });
    // 四面都是自己人，通常是眼，填了就少一眼
    if (adjFriendlies === 4) score -= 30000; 
    // 三面自己人，可能是做眼的关键点，也可能是填眼，视情况而定，但通常不建议盲目填
    if (adjFriendlies === 3 && !connectedWeakGroup) score -= 1000; 

    // --- 3. 大场与领地 (基础权重) ---
    
    const strategicVal = getStrategicValue(p.row, p.col, size, board.size);
    score += strategicVal;

    // 领地逻辑：不要在完全确定的己方领地内填子，除非有入侵者
    if (currentTerritory.get(k) === player) {
         // 检查周围5x5范围是否有敌子 (入侵者)
         let hasInvader = false;
         for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                const nr = p.row + dr, nc = p.col + dc;
                if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                    if (board.get(posKey({row: nr, col: nc})) === opponent) hasInvader = true;
                }
            }
        }
        if (!hasInvader) score -= 20000; 
    }

    candidateMoves.push({ pos: p, score });
  });

  candidateMoves.sort((a, b) => b.score - a.score);
  
  const finalMove = candidateMoves.length > 0 ? candidateMoves[0].pos : null;
  const topCandidates = candidateMoves.slice(0, 5);

  return { move: finalMove, candidates: topCandidates };
};
