
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

export enum AiLevel {
  Easy = "入门",
  Medium = "进阶",
  Hard = "大师"
}

export interface Position {
  row: number;
  col: number;
}

export interface ScoredMove {
  pos: Position;
  score: number;
}

export interface BoardHistory {
  board: BoardState;
  player: Player;
  lastMove: Position | null;
}

export const posKey = (p: Position): string => `${p.row},${p.col}`;
export const keyToPos = (k: string): Position => {
  const [row, col] = k.split(',').map(Number);
  return { row, col };
};

export const isSamePos = (a: Position | null | undefined, b: Position | null | undefined): boolean => {
  if (!a || !b) return false;
  return a.row === b.row && a.col === b.col;
};

export type BoardState = Map<string, Player>;

export interface GroupInfo {
  stones: Position[];
  liberties: Position[];
  player: Player;
}

export const BOARD_SIZES = [9, 13, 19];

declare global {
  interface Window {
    Peer: any;
  }
}
