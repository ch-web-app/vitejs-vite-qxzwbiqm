
import { Position } from '../types';

interface OpeningBook {
  name: string;
  size: number;
  // Moves sequence: Black, White, Black, White...
  moves: Position[];
}

// Helper to create moves easily
const m = (row: number, col: number) => ({ row, col });

export const OPENING_BOOKS: OpeningBook[] = [
  // --- 9x9 Openings ---
  {
    name: "9路-天元开局",
    size: 9,
    moves: [
      m(4,4), m(2,6), m(6,2), m(6,6), m(2,2)
    ]
  },
  {
    name: "9路-星位开局",
    size: 9,
    moves: [
      m(2,6), m(6,2), m(6,6), m(2,2), m(4,4)
    ]
  },
  {
    name: "9路-平衡对攻",
    size: 9,
    moves: [
      m(2,4), m(6,4), m(4,2), m(4,6)
    ]
  },

  // --- 13x13 Openings ---
  {
    name: "13路-星位对角",
    size: 13,
    moves: [
      m(3,9), m(9,3), m(9,9), m(3,3)
    ]
  },
  {
    name: "13路-星小目",
    size: 13,
    moves: [
      m(3,9), m(9,3), m(10,9), m(2,3)
    ]
  },

  // --- 19x19 Openings (The Classics) ---
  {
    name: "三连星 (Sanrensei)",
    size: 19,
    moves: [
      m(3,15), m(15,3), m(15,15), m(3,3), m(9,15), m(3,9) // Black builds framework
    ]
  },
  {
    name: "中国流 (Chinese Opening)",
    size: 19,
    moves: [
      m(3,15), m(15,3), m(2,16), m(3,3), m(9,16) // The characteristic stone at R10 (9,16 in 0-indexed)
    ]
  },
  {
    name: "小林流 (Kobayashi)",
    size: 19,
    moves: [
      m(3,15), m(15,3), m(2,16), m(15,15), m(5,16) // Stone at F3 equivalent
    ]
  },
  {
    name: "星小目-挂角定式",
    size: 19,
    moves: [
      m(3,15), m(15,3), m(2,16), m(5,16), m(13,2)
    ]
  },
  {
    name: "对角星布局",
    size: 19,
    moves: [
      m(3,15), m(3,3), m(15,15), m(15,3)
    ]
  }
];

// Transformations to handle symmetries (Rotate 90, 180, 270, Mirrors)
// This is a simplified version: checking the exact defined sequences first.
// A full implementation would canonicalize board states, but for "Guidance"
// following specific "book" paths is sufficient.
