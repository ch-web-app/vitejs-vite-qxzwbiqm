
import { Position } from '../types';

export interface OpeningBook {
  name: string;
  size: number;
  // Moves sequence: Black, White, Black, White...
  moves: Position[];
}

// Helper to create moves easily
const m = (row: number, col: number) => ({ row, col });

const BASE_BOOKS: OpeningBook[] = [
  // --- 9x9 Openings ---
  // 1. Tengen (Center) - Aggressive/Fighting
  {
    name: "9路-天元流",
    size: 9,
    moves: [m(4,4), m(2,6), m(6,2), m(6,6), m(2,2)]
  },
  // 2. San-san (3-3 point) - Territorial
  {
    name: "9路-三三流",
    size: 9,
    moves: [m(2,2), m(6,6), m(2,6), m(6,2), m(4,4)]
  },
  // 3. Komoku (3-4 point) - Balanced
  {
    name: "9路-小目流",
    size: 9,
    moves: [m(2,3), m(6,5), m(6,2), m(2,6), m(4,4)]
  },
  // 4. Mokuhazushi (3-5 point) - Influence oriented
  {
    name: "9路-目外流",
    size: 9,
    moves: [m(2,4), m(6,4), m(4,2), m(4,6)] 
  },
  // 5. Takamoku (4-5 point) - High stance
  {
    name: "9路-高目流",
    size: 9,
    moves: [m(3,4), m(5,4), m(4,3), m(4,5)]
  },
  // 6. Center Contact - Immediate fighting
  {
     name: "9路-天元激战",
     size: 9,
     moves: [m(4,4), m(3,4), m(4,3), m(4,5), m(5,4)]
  },
  // 7. Cross Hoshi - Symmetrical
  {
     name: "9路-对角星",
     size: 9,
     moves: [m(2,6), m(6,2), m(5,5), m(3,3)]
  },
  // 8. Parallel - Simple
  {
    name: "9路-平行布局",
    size: 9,
    moves: [m(2,2), m(2,6), m(6,2), m(6,6)]
  },

  // --- 13x13 Openings ---
  {
    name: "13路-星位连占",
    size: 13,
    moves: [m(3,9), m(9,3), m(9,9), m(3,3)]
  },
  {
    name: "13路-三三对抗",
    size: 13,
    moves: [m(2,2), m(10,10), m(10,2), m(2,10)]
  },
  {
    name: "13路-星小目",
    size: 13,
    moves: [m(3,9), m(9,3), m(10,9), m(2,3)]
  },

  // --- 19x19 Openings ---
  {
    name: "三连星 (Sanrensei)",
    size: 19,
    moves: [m(3,15), m(15,3), m(15,15), m(3,3), m(9,15), m(9,3)]
  },
  {
    name: "中国流 (Chinese Opening)",
    size: 19,
    moves: [m(3,15), m(15,3), m(2,16), m(3,3), m(9,16)]
  },
  {
    name: "小林流 (Kobayashi)",
    size: 19,
    moves: [m(3,15), m(15,3), m(2,16), m(15,15), m(5,16)]
  },
  {
    name: "星小目-挂角定式",
    size: 19,
    moves: [m(3,15), m(15,3), m(2,16), m(5,16), m(13,2)]
  },
  {
    name: "对角星布局",
    size: 19,
    moves: [m(3,15), m(3,3), m(15,15), m(15,3)]
  }
];

// Generate all 8 symmetries for a board position to ensure the book works 
// regardless of which corner or rotation the player chooses.
const transform = (p: Position, size: number, mode: number): Position => {
  const { row: r, col: c } = p;
  const s = size - 1;
  switch (mode) {
    case 0: return { row: r, col: c }; // Identity
    case 1: return { row: c, col: s - r }; // Rot 90
    case 2: return { row: s - r, col: s - c }; // Rot 180
    case 3: return { row: s - c, col: r }; // Rot 270
    case 4: return { row: r, col: s - c }; // Flip X (Horizontal mirror)
    case 5: return { row: s - r, col: c }; // Flip Y (Vertical mirror)
    case 6: return { row: c, col: r }; // Diagonal 1 (Main)
    case 7: return { row: s - c, col: s - r }; // Diagonal 2
    default: return p;
  }
};

const expandBooks = (base: OpeningBook[]): OpeningBook[] => {
  const expanded: OpeningBook[] = [];
  
  base.forEach(book => {
    // Generate 8 variations for every book
    for (let i = 0; i < 8; i++) {
      expanded.push({
        name: `${book.name}-Var${i}`,
        size: book.size,
        moves: book.moves.map(move => transform(move, book.size, i))
      });
    }
  });
  
  return expanded;
};

export const OPENING_BOOKS = expandBooks(BASE_BOOKS);
