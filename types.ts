export enum Player {
  Black = "Black",
  White = "White"
}

export enum GameMode {
  Local = "Local",
  AI = "AI",
  OnlineHost = "OnlineHost",
  OnlineJoin = "OnlineJoin"
}

export interface Position {
  row: number;
  col: number;
}

// Helper to use Position as a Map key string "row,col"
export const posKey = (p: Position): string => `${p.row},${p.col}`;
export const keyToPos = (k: string): Position => {
  const [row, col] = k.split(',').map(Number);
  return { row, col };
};

export type BoardState = Map<string, Player>;

export interface GroupInfo {
  stones: Position[];
  liberties: Position[];
  player: Player;
}

export const BOARD_SIZES = [9, 13, 19];

// Declare global PeerJS types since we are loading from CDN
declare global {
  interface Window {
    Peer: any;
  }
}