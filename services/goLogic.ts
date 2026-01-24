import { BoardState, Player, Position, posKey, keyToPos, GroupInfo } from '../types';

export const getGroupAndLiberties = (board: BoardState, size: number, startPos: Position): GroupInfo => {
  const startKey = posKey(startPos);
  const player = board.get(startKey);
  
  if (!player) {
    return { stones: [], liberties: [], player: Player.Black }; // Should not happen if called correctly
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

// Returns new board state and boolean indicating if move was valid (and executed)
// Also handles capturing
export const executeMove = (
  currentBoard: BoardState, 
  size: number, 
  pos: Position, 
  player: Player
): { newBoard: BoardState, captured: boolean, valid: boolean } => {
  const key = posKey(pos);
  if (currentBoard.has(key)) return { newBoard: currentBoard, captured: false, valid: false };

  // 1. Place stone temporarily
  const nextBoard = new Map(currentBoard);
  nextBoard.set(key, player);

  // 2. Check for captures of opponent
  const opponent = player === Player.Black ? Player.White : Player.Black;
  let didCapture = false;
  
  // Check all neighbors for opponent groups
  const neighbors = [
    { row: pos.row - 1, col: pos.col },
    { row: pos.row + 1, col: pos.col },
    { row: pos.row, col: pos.col - 1 },
    { row: pos.row, col: pos.col + 1 },
  ];

  neighbors.forEach(n => {
    if (n.row >= 0 && n.row < size && n.col >= 0 && n.col < size) {
      const nKey = posKey(n);
      if (nextBoard.get(nKey) === opponent) {
        const groupInfo = getGroupAndLiberties(nextBoard, size, n);
        if (groupInfo.liberties.length === 0) {
          // Capture!
          didCapture = true;
          groupInfo.stones.forEach(s => nextBoard.delete(posKey(s)));
        }
      }
    }
  });

  // 3. Check for suicide (if no captures made, and I have no liberties, it's invalid)
  // Note: Some rule sets allow suicide, but standard usually forbids it unless it captures.
  // The Swift code allows placement then checks: "if myInfo.liberties.isEmpty && !capturedAny { undo }"
  if (!didCapture) {
    const myInfo = getGroupAndLiberties(nextBoard, size, pos);
    if (myInfo.liberties.length === 0) {
      return { newBoard: currentBoard, captured: false, valid: false }; // Suicide move rejected
    }
  }

  return { newBoard: nextBoard, captured: didCapture, valid: true };
};

export const getAIThinkingMove = (board: BoardState, size: number): Position | null => {
  // Simple AI: Random empty spot
  const emptySpots: Position[] = [];
  for(let r=0; r<size; r++) {
    for(let c=0; c<size; c++) {
      const p = {row: r, col: c};
      if(!board.has(posKey(p))) {
        // Basic filter: don't play immediate suicide
        // This is a very dumb check, just simulating the Swift "random element"
        emptySpots.push(p);
      }
    }
  }
  
  if (emptySpots.length === 0) return null;
  return emptySpots[Math.floor(Math.random() * emptySpots.length)];
};