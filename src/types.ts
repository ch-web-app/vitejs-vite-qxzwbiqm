export enum Player {
  Black = "Black",
  White = "White"
}

export interface Position {
  row: number;
  col: number;
}

export interface StoneGroup {
  id: string; // Unique ID for React keys
  player: Player;
  stones: Position[];
  expression: string;
}

export const RANKS = [
  { label: "Beginner (30k)", value: "30k", elo: 600, desc: "Just learned the rules. Focuses only on capturing." },
  { label: "Casual (18k)", value: "18k", elo: 900, desc: "Understands basic shapes but plays fearfully." },
  { label: "Intermediate (10k)", value: "10k", elo: 1200, desc: "Solid fundamentals, good local fighting." },
  { label: "Advanced (1k)", value: "1k", elo: 1800, desc: "Strong amateur. Knows joseki and direction of play." },
  { label: "Amateur Dan (1d)", value: "1d", elo: 2100, desc: "Mastered basic strategies. Rarely makes blunder." },
  { label: "Master (5d)", value: "5d", elo: 2500, desc: "Regional tournament level. High efficiency." },
  { label: "Professional (1p)", value: "1p", elo: 2700, desc: "Certified Pro. Deep reading ability." },
  { label: "Top Pro (9p)", value: "9p", elo: 3000, desc: "World Champion level. Optimal play." },
] as const;

export type RankValue = typeof RANKS[number]['value'];

export const EXPRESSION_POOL = [
  "(•‿•)", "(^ω^)", "(´∀｀)", "(๑>؂<๑)", 
  "(•̀ω•́)", "(〃'▽'〃)", "(๑•̀ㅂ•́)و", "(^～^)", 
  "(*^▽^*)", "(oﾟ▽ﾟ)o", "(๑˘▽˘๑)", "(◕‿◕)", 
  "( ◡‿◡ )", "(^▽^)"
];