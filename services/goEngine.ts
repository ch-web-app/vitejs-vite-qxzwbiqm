import { GoogleGenAI, Type } from "@google/genai";
import { Player, Position, EXPRESSION_POOL, StoneGroup, RankValue } from '../types';

export class GoEngine {
  size: number;
  board: Map<string, Player>; // Key: "row,col"
  currentPlayer: Player;
  isVsAI: boolean;
  isThinking: boolean;
  rank: RankValue = "9p"; // Default to strongest
  groupExpressions: Map<string, string>; // Key: "row,col" of the 'leader' stone -> expression
  lastAIThought: string = ""; // Store AI reasoning
  lastError: string | null = null; // Store validation errors (Ko, Suicide)
  
  // Ko Rule: Tracks the board state signature before the *opponent's* last move.
  // We cannot make a move that reverts the board to this exact state.
  private koBanState: string | null = null; 

  constructor(size: number = 9) {
    this.size = size;
    this.board = new Map();
    this.currentPlayer = Player.Black;
    this.isVsAI = false;
    this.isThinking = false;
    this.groupExpressions = new Map();
  }

  setRank(rank: RankValue) {
    this.rank = rank;
  }

  // Helper to serialize position
  private posKey(pos: Position): string {
    return `${pos.row},${pos.col}`;
  }

  // Helper to parse position
  private parseKey(key: string): Position {
    const [r, c] = key.split(',').map(Number);
    return { row: r, col: c };
  }

  // Generates a unique signature for a board state
  private getSignatureFromMap(board: Map<string, Player>): string {
    // Sort keys to ensure canonical representation regardless of insertion order
    const keys = Array.from(board.keys()).sort();
    return keys.map(k => `${k}:${board.get(k)}`).join('|');
  }

  setupBoard(size: number) {
    this.size = size;
    this.board.clear();
    this.groupExpressions.clear();
    this.currentPlayer = Player.Black;
    this.isThinking = false;
    this.koBanState = null;
    this.lastAIThought = "";
    this.lastError = null;
  }

  placeStone(pos: Position, callback: () => void) {
    const key = this.posKey(pos);
    
    // Reset error state on new attempt
    this.lastError = null;

    if (this.board.has(key) || this.isThinking) return;

    // 1. Try to execute move
    const moveSuccessful = this.executeMove(pos, this.currentPlayer);
    
    // If move was invalid (Suicide or Ko), we still callback to update UI (show error)
    if (!moveSuccessful) {
        callback(); 
        return;
    }

    callback(); // Trigger UI update for successful move

    if (this.isVsAI) {
      this.isThinking = true;
      this.currentPlayer = Player.White;
      callback();

      // Trigger AI Move asynchronously
      this.makeSmartAIMove().then(() => {
        this.currentPlayer = Player.Black;
        this.isThinking = false;
        callback();
      });
    } else {
      this.currentPlayer = this.currentPlayer === Player.Black ? Player.White : Player.Black;
      callback();
    }
  }

  // Returns true if move was valid and applied, false otherwise
  private executeMove(pos: Position, player: Player): boolean {
    // Clear error at start of execution attempt (important for AI/Random retries)
    this.lastError = null;

    const key = this.posKey(pos);
    
    // Create a temporary board to simulate the move
    const nextBoard = new Map(this.board);
    nextBoard.set(key, player);
    
    const opponent = player === Player.Black ? Player.White : Player.Black;

    // 1. Check Captures (Rule: Capture opponent first)
    const capturedAny = this.removeCapturedStonesFromMap(nextBoard, opponent);
    
    // 2. Check Self Liberties (Rule: Suicide check)
    // A move is suicide if the group has no liberties AND it didn't capture any opponent stones.
    const { liberties } = this.getGroupAndLibertiesFromMap(nextBoard, pos);
    if (liberties.size === 0 && !capturedAny) {
      this.lastError = "Suicide forbidden! Stone would have no liberties.";
      return false; // Invalid move: Suicide
    }

    // 3. Check Ko (Rule: Cannot return to previous state)
    // The board state after this move must not equal the state before the opponent's last move.
    const newSignature = this.getSignatureFromMap(nextBoard);
    if (newSignature === this.koBanState) {
        this.lastError = "Ko Rule! Cannot immediately recreate previous board state.";
        return false; 
    }

    // Move is valid - Apply to real state
    
    // Store the CURRENT state (before this move is applied) as the forbidden state for the NEXT player.
    // This effectively "locks" the state that existed before this move, preventing the opponent from recreating it immediately.
    this.koBanState = this.getSignatureFromMap(this.board);
    
    this.board = nextBoard;
    
    // Clean up expressions for captured stones
    for (const k of this.groupExpressions.keys()) {
        if (!this.board.has(k)) {
            this.groupExpressions.delete(k);
        }
    }

    return true;
  }

  private generateASCIIBoard(): string {
    let output = `Board Size: ${this.size}x${this.size}\n`;
    output += "   " + Array.from({length: this.size}, (_, i) => i).join(" ") + "\n";
    for (let r = 0; r < this.size; r++) {
        let rowStr = `${r}  `;
        for (let c = 0; c < this.size; c++) {
            const val = this.board.get(`${r},${c}`);
            if (val === Player.Black) rowStr += "B ";
            else if (val === Player.White) rowStr += "W ";
            else rowStr += ". ";
        }
        output += rowStr + "\n";
    }
    return output;
  }

  // Generates specific instructions based on the selected Rank
  private getRankBehavior(): { prompt: string, temperature: number, thinkingBudget: number } {
    const r = this.rank;
    const isPro = r.endsWith('p');
    const isDan = r.endsWith('d');
    const isKyu = r.endsWith('k');
    const level = isKyu ? parseInt(r.replace('k', '')) : 0;

    // 1. Top Pro (9p) & Pro (1p)
    // High thinking budget to simulate long thinking time (~20-30 seconds)
    // Low temperature for optimal play.
    if (r === '9p' || r === '1p') {
        return {
            prompt: `You are a World Champion Go AI (Rank: ${r}). 
            - Play the OPTIMAL move (Kami no Itte).
            - Focus on maximum efficiency (Honte).
            - Read ahead deep into the game variations.
            - Punish overplays instantly.
            - Do not play small local moves if a big move exists elsewhere (Tenuki).`,
            temperature: 0.0, 
            thinkingBudget: 3000 // High budget for max ~30s thinking
        };
    }

    // 2. Dan Level (1d - 5d)
    // Moderate thinking budget (~5-10 seconds)
    if (isDan) {
        return {
            prompt: `You are a strong Amateur Dan player (Rank: ${r}).
            - You have strong fundamentals and know Joseki (corner patterns).
            - You calculate liberties correctly in fights.
            - You generally find the right direction of play.
            - You play solid moves but lack the deep creativity of a pro.`,
            temperature: 0.2, 
            thinkingBudget: 1024 // Moderate budget
        };
    }

    // 3. Strong Kyu (1k)
    // Low thinking budget (~2-5 seconds)
    if (r === '1k') {
        return {
            prompt: `You are a strong amateur (Rank: 1k).
            - You play solid moves but might miss a complex ladder or net.
            - You are aggressive but sometimes greedy.
            - You know basic Joseki.`,
            temperature: 0.4,
            thinkingBudget: 512 // Low budget
        };
    }

    // 4. Intermediate (10k)
    // Minimal thinking budget (Fast, ~1-2s)
    if (r === '10k') {
        return {
            prompt: `You are an intermediate casual player (Rank: 10k).
            - Play defensively (Puppy Go). Respond to the opponent locally.
            - Focus on local shapes rather than global strategy.
            - You sometimes make inefficient moves (Over-concentrated).
            - Simulate a winrate loss of ~2-5% per move.`,
            temperature: 0.7,
            thinkingBudget: 0 // Fast response
        };
    }

    // 5. Beginner (18k, 30k)
    // Zero thinking budget (Instant, <1s ideally)
    return {
        prompt: `You are a beginner Go player (Rank: ${r}).
        - You barely understand strategy.
        - Focus ONLY on capturing stones next to you (Atari).
        - Ignore big open spaces (Corners).
        - Play inside your own territory occasionally.
        - Make "Empty Triangles" (bad shape).
        - SIMULATE MISTAKES: Your moves should often be blunders.
        - Winrate loss per move: >10%.`,
        temperature: 1.0 + (level >= 25 ? 0.2 : 0.0), // High noise
        thinkingBudget: 0 // Fastest response possible
    };
  }

  private async makeSmartAIMove() {
    try {
        const boardASCII = this.generateASCIIBoard();
        const { prompt: rankInstructions, temperature, thinkingBudget } = this.getRankBehavior();

        const prompt = `
${rankInstructions}

You are playing White (W). Opponent is Black (B).
Current Board State:
${boardASCII}

Task:
1. Analyze the board based on your persona (${this.rank}).
2. Select a move.
   - If you are a beginner, YOU MUST make a move that a beginner would make (e.g., bad shape, ignoring big points).
   - If you are a pro, play the best move.
3. Return JSON ONLY.

JSON Format:
{
  "row": number,
  "col": number,
  "reasoning": "string (max 20 words explaining the move from the perspective of a ${this.rank} player)"
}
`;

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                temperature: temperature, 
                // Only apply thinking budget if > 0. 
                // Gemini 3 Flash supports thinking config.
                ...(thinkingBudget > 0 ? { thinkingConfig: { thinkingBudget } } : {}),
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        row: { type: Type.INTEGER, description: "Row index (0-based)" },
                        col: { type: Type.INTEGER, description: "Column index (0-based)" },
                        reasoning: { type: Type.STRING, description: "Strategic explanation" }
                    },
                    required: ["row", "col", "reasoning"]
                }
            }
        });

        const json = JSON.parse(response.text || "{}");
        if (json.row !== undefined && json.col !== undefined) {
            const move = { row: json.row, col: json.col };
            // Validate move locally
            if (this.executeMove(move, Player.White)) {
                this.lastAIThought = json.reasoning || "Playing...";
                return;
            } else {
                console.warn("AI suggested invalid move (Ko or Suicide), falling back to random.");
            }
        }
    } catch (error) {
        console.error("AI Error:", error);
    }

    // Fallback if AI fails or makes invalid move
    this.makeRandomMove();
    this.lastAIThought = "I'm confused... playing randomly.";
  }

  private makeRandomMove() {
    const empties: Position[] = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (!this.board.has(`${r},${c}`)) {
          empties.push({ row: r, col: c });
        }
      }
    }

    // Shuffle empties
    for (let i = empties.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [empties[i], empties[j]] = [empties[j], empties[i]];
    }

    for (const move of empties) {
        if (this.executeMove(move, Player.White)) {
            return;
        }
    }
  }

  private removeCapturedStonesFromMap(board: Map<string, Player>, player: Player): boolean {
    const visited = new Set<string>();
    let didCapture = false;
    const stonesToRemove: string[] = [];

    // Identify all stones to remove first
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const p: Position = { row: r, col: c };
        const key = this.posKey(p);

        if (board.get(key) === player && !visited.has(key)) {
          const { stones, liberties } = this.getGroupAndLibertiesFromMap(board, p);
          
          if (liberties.size === 0) {
            stones.forEach(s => stonesToRemove.push(s));
            didCapture = true;
          }
          
          stones.forEach(s => visited.add(s));
        }
      }
    }

    // Apply removal
    stonesToRemove.forEach(k => board.delete(k));
    
    return didCapture;
  }

  private removeCapturedStones(player: Player): boolean {
      return this.removeCapturedStonesFromMap(this.board, player);
  }

  // Generalized version that works on any map
  private getGroupAndLibertiesFromMap(board: Map<string, Player>, pos: Position): { stones: Set<string>, liberties: Set<string> } {
    const key = this.posKey(pos);
    const color = board.get(key);
    const stones = new Set<string>();
    const liberties = new Set<string>();
    
    if (!color) return { stones, liberties };

    const queue: Position[] = [pos];
    stones.add(key);

    let head = 0;
    while(head < queue.length) {
      const curr = queue[head];
      head++;

      const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dr, dc] of directions) {
        const next: Position = { row: curr.row + dr, col: curr.col + dc };
        
        // Check bounds
        if (next.row >= 0 && next.row < this.size && next.col >= 0 && next.col < this.size) {
          const nextKey = this.posKey(next);
          const nextColor = board.get(nextKey);

          if (nextColor === color) {
            if (!stones.has(nextKey)) {
              stones.add(nextKey);
              queue.push(next);
            }
          } else if (nextColor === undefined) {
            liberties.add(nextKey);
          }
        }
      }
    }

    return { stones, liberties };
  }

  // Keeps the public API compatible
  private getGroupAndLiberties(pos: Position) {
      return this.getGroupAndLibertiesFromMap(this.board, pos);
  }

  getRenderGroups(): StoneGroup[] {
    const groups: StoneGroup[] = [];
    const visited = new Set<string>();
    const sortedKeys = Array.from(this.board.keys()).sort((a, b) => {
        const pa = this.parseKey(a);
        const pb = this.parseKey(b);
        if (pa.row !== pb.row) return pa.row - pb.row;
        return pa.col - pb.col;
    });

    for (const key of sortedKeys) {
        if (visited.has(key)) continue;

        const pos = this.parseKey(key);
        const { stones } = this.getGroupAndLiberties(pos);
        const player = this.board.get(key)!;
        
        const stoneList = Array.from(stones).map(k => this.parseKey(k));
        stoneList.sort((a, b) => (a.row - b.row) || (a.col - b.col));
        const leaderKey = this.posKey(stoneList[0]);

        if (!this.groupExpressions.has(leaderKey)) {
             const randomExp = EXPRESSION_POOL[Math.floor(Math.random() * EXPRESSION_POOL.length)];
             this.groupExpressions.set(leaderKey, randomExp);
        }

        groups.push({
            id: leaderKey,
            player,
            stones: stoneList,
            expression: this.groupExpressions.get(leaderKey)!
        });

        stones.forEach(s => visited.add(s));
    }
    return groups;
  }
  
  getScore(): { black: number, white: number } {
      let b = 0, w = 0;
      this.board.forEach((val) => {
          if (val === Player.Black) b++;
          else w++;
      });
      return { black: b, white: w };
  }
}
