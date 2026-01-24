import { Player, Position, EXPRESSION_POOL, StoneGroup, RankValue } from '../types';
import { Peer, DataConnection } from 'peerjs';

export class GoEngine {
  size: number;
  board: Map<string, Player>;
  currentPlayer: Player;
  isVsAI: boolean;
  isThinking: boolean;
  rank: RankValue = "9p";
  groupExpressions: Map<string, string>;
  lastAIThought: string = "";
  lastError: string | null = null;
  
  // --- Network State ---
  public isNetworkGame: boolean = false;
  public myNetworkColor: Player = Player.Black; // Host is Black, Joiner is White
  public networkStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  public roomId: string | null = null;
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private onNetworkUpdate: (() => void) | null = null; // Callback to UI
  
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
  
  setNetworkCallback(cb: () => void) {
      this.onNetworkUpdate = cb;
  }

  // --- Network Methods ---

  private generateRoomId(): string {
      return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async hostGame(size: number) {
      this.cleanupNetwork();
      this.setupBoard(size); // Reset board for new game
      this.isNetworkGame = true;
      this.isVsAI = false;
      this.myNetworkColor = Player.Black; // Host plays first
      this.networkStatus = 'connecting';
      this.roomId = this.generateRoomId();
      
      const peerId = `cutego-${this.roomId}`;
      
      try {
          // Use the explicit Peer import from peerjs
          this.peer = new Peer(peerId);

          this.peer.on('open', (id) => {
              console.log('My peer ID is: ' + id);
              this.networkStatus = 'connecting'; 
              this.onNetworkUpdate?.();
          });

          this.peer.on('connection', (conn) => {
              this.conn = conn;
              this.setupConnectionHandlers();
              this.networkStatus = 'connected';
              
              // Full State Synchronization
              conn.send({ 
                type: 'sync', 
                size: this.size,
                board: Array.from(this.board.entries()),
                turn: this.currentPlayer
              });
              
              this.onNetworkUpdate?.();
          });

          this.peer.on('error', (err) => {
              console.error("PeerJS Error:", err);
              this.lastError = "Network Error: " + (err.type || "Unknown");
              this.networkStatus = 'disconnected';
              this.onNetworkUpdate?.();
          });
      } catch (e) {
          console.error("Failed to init PeerJS:", e);
          this.lastError = "Failed to load Network Module";
      }
  }

  async joinGame(roomId: string) {
      this.cleanupNetwork();
      this.isNetworkGame = true;
      this.isVsAI = false;
      this.myNetworkColor = Player.White; // Joiner plays second
      this.networkStatus = 'connecting';
      this.roomId = roomId;

      try {
          this.peer = new Peer(); // Auto ID for joiner

          this.peer.on('open', () => {
              const destId = `cutego-${roomId}`;
              this.conn = this.peer!.connect(destId);
              this.setupConnectionHandlers();
          });

          this.peer.on('error', (err) => {
              console.error(err);
              this.lastError = "Could not connect to: " + roomId;
              this.networkStatus = 'disconnected';
              this.onNetworkUpdate?.();
          });
      } catch (e) {
          console.error("Failed to init PeerJS:", e);
          this.lastError = "Failed to load Network Module";
      }
  }

  private setupConnectionHandlers() {
      if (!this.conn) return;

      this.conn.on('open', () => {
          this.networkStatus = 'connected';
          this.onNetworkUpdate?.();
      });

      this.conn.on('data', (data: any) => {
          this.handleNetworkData(data);
          this.onNetworkUpdate?.();
      });

      this.conn.on('close', () => {
          this.lastError = "Opponent disconnected";
          this.networkStatus = 'disconnected';
          this.onNetworkUpdate?.();
      });
  }

  private handleNetworkData(data: any) {
      if (data.type === 'move') {
          // Opponent made a move
          this.executeMove(data.pos, this.currentPlayer);
          this.currentPlayer = this.currentPlayer === Player.Black ? Player.White : Player.Black;
          this.lastAIThought = ""; 
          
      } else if (data.type === 'sync') {
          // Received full state from Host
          if (data.size && data.size !== this.size) {
              this.size = data.size;
              // We don't call setupBoard here to avoid clearing the board map we are about to set
          }
          if (data.board) {
              this.board = new Map(data.board);
          }
          if (data.turn) {
              this.currentPlayer = data.turn;
          }
          this.groupExpressions.clear(); // Clear expressions to regenerate fresh ones
          
      } else if (data.type === 'resign') {
          this.lastError = "Opponent Resigned!";
      }
  }

  public cleanupNetwork() {
      if (this.conn) {
          this.conn.close();
          this.conn = null;
      }
      if (this.peer) {
          this.peer.destroy();
          this.peer = null;
      }
      this.networkStatus = 'disconnected';
      this.isNetworkGame = false;
      this.roomId = null;
  }
  
  public sendResign() {
      if (this.isNetworkGame && this.conn) {
          this.conn.send({ type: 'resign' });
      }
  }

  // --- End Network Methods ---

  private posKey(pos: Position): string {
    return `${pos.row},${pos.col}`;
  }

  private parseKey(key: string): Position {
    const [r, c] = key.split(',').map(Number);
    return { row: r, col: c };
  }

  private getSignatureFromMap(board: Map<string, Player>): string {
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
    this.lastError = null;

    // Network Game: Block input if it's not my turn
    if (this.isNetworkGame) {
        if (this.networkStatus !== 'connected') return;
        if (this.currentPlayer !== this.myNetworkColor) return;
    }

    if (this.board.has(key) || this.isThinking) return;

    const moveSuccessful = this.executeMove(pos, this.currentPlayer);
    
    if (!moveSuccessful) {
        callback(); 
        return;
    }

    // Move success, send to network if needed
    if (this.isNetworkGame && this.conn) {
        this.conn.send({ type: 'move', pos });
    }

    callback();

    if (this.isVsAI && !this.isNetworkGame) {
      this.isThinking = true;
      this.currentPlayer = Player.White;
      callback();

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

  private executeMove(pos: Position, player: Player): boolean {
    this.lastError = null;
    const key = this.posKey(pos);
    const nextBoard = new Map(this.board);
    nextBoard.set(key, player);
    const opponent = player === Player.Black ? Player.White : Player.Black;

    const capturedAny = this.removeCapturedStonesFromMap(nextBoard, opponent);
    const { liberties } = this.getGroupAndLibertiesFromMap(nextBoard, pos);
    
    if (liberties.size === 0 && !capturedAny) {
      this.lastError = "Suicide forbidden!";
      return false;
    }

    const newSignature = this.getSignatureFromMap(nextBoard);
    if (newSignature === this.koBanState) {
        this.lastError = "Ko Rule!";
        return false; 
    }

    this.koBanState = this.getSignatureFromMap(this.board);
    this.board = nextBoard;
    
    for (const k of this.groupExpressions.keys()) {
        if (!this.board.has(k)) {
            this.groupExpressions.delete(k);
        }
    }
    return true;
  }

  private async makeSmartAIMove() {
    // Artificial delay to simulate thinking
    const delay = 600 + Math.random() * 400;
    await new Promise(resolve => setTimeout(resolve, delay));

    this.makeHeuristicMove();
  }

  private makeHeuristicMove() {
    const possibleMoves: { pos: Position, score: number, reason: string }[] = [];
    const empties: Position[] = [];

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (!this.board.has(`${r},${c}`)) {
           empties.push({ row: r, col: c });
        }
      }
    }

    for (const move of empties) {
        const nextBoard = new Map(this.board);
        const key = this.posKey(move);
        nextBoard.set(key, Player.White);
        
        const { liberties: myLibs } = this.getGroupAndLibertiesFromMap(nextBoard, move);
        const capturedOpponents = this.removeCapturedStonesFromMap(nextBoard, Player.Black);

        if (myLibs.size === 0 && !capturedOpponents) continue;
        if (this.getSignatureFromMap(nextBoard) === this.koBanState) continue;

        let score = 0;
        let reason = "Exploration";

        if (capturedOpponents) { score += 100; reason = "I capture your stones!"; }

        const adjacents = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        let savedSelf = false;
        for (const [dr, dc] of adjacents) {
            const nr = move.row + dr, nc = move.col + dc;
            if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
                const nKey = `${nr},${nc}`;
                const neighborColor = this.board.get(nKey);
                
                if (neighborColor === Player.White) {
                     const { liberties: oldLibs } = this.getGroupAndLibertiesFromMap(this.board, {row:nr, col:nc});
                     if (oldLibs.size === 1) { score += 50; reason = "Saving my stones!"; savedSelf = true; }
                }
                 if (neighborColor === Player.Black) {
                     const { liberties: oppLibs } = this.getGroupAndLibertiesFromMap(nextBoard, {row:nr, col:nc});
                     if (oppLibs.size === 1) { score += 30; reason = "Atari!"; }
                 }
            }
        }
        
        if (!savedSelf && !capturedOpponents) {
            let ownNeighbors = 0;
            let totalNeighbors = 0;
            for (const [dr, dc] of adjacents) {
                 const nr = move.row + dr, nc = move.col + dc;
                 if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
                     totalNeighbors++;
                     if (this.board.get(`${nr},${nc}`) === Player.White) ownNeighbors++;
                 }
            }
            if (totalNeighbors > 0 && ownNeighbors === totalNeighbors) { score -= 15; reason = "Avoiding bad shape"; }
        }

        if (this.board.size < 10) {
            if ((move.row === 2 || move.row === 6) && (move.col === 2 || move.col === 6)) score += 5;
            if (move.row === 4 && move.col === 4) score += 5;
        }

        score += Math.random() * 5;
        possibleMoves.push({ pos: move, score, reason });
    }

    possibleMoves.sort((a, b) => b.score - a.score);

    if (possibleMoves.length === 0) { this.lastAIThought = "Pass"; return; }

    let chosenMove = possibleMoves[0];
    let mistakeChance = 0;
    switch (this.rank) {
        case "30k": mistakeChance = 0.8; break;
        case "18k": mistakeChance = 0.6; break;
        case "10k": mistakeChance = 0.3; break;
        case "1k": mistakeChance = 0.1; break;
        default: mistakeChance = 0;
    }

    if (Math.random() < mistakeChance && possibleMoves.length > 1) {
        const poolSize = this.rank === "30k" ? possibleMoves.length : Math.ceil(possibleMoves.length * 0.5);
        const randomIndex = Math.floor(Math.random() * poolSize);
        chosenMove = possibleMoves[randomIndex];
        chosenMove.reason = "Just playing around..."; 
    }

    if (this.executeMove(chosenMove.pos, Player.White)) {
        this.lastAIThought = chosenMove.score > 20 ? chosenMove.reason : "Thinking...";
    } else {
        this.lastAIThought = "Pass";
    }
  }

  private removeCapturedStonesFromMap(board: Map<string, Player>, player: Player): boolean {
    const visited = new Set<string>();
    let didCapture = false;
    const stonesToRemove: string[] = [];
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
    stonesToRemove.forEach(k => board.delete(k));
    return didCapture;
  }

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
        if (next.row >= 0 && next.row < this.size && next.col >= 0 && next.col < this.size) {
          const nextKey = this.posKey(next);
          const nextColor = board.get(nextKey);
          if (nextColor === color) {
            if (!stones.has(nextKey)) { stones.add(nextKey); queue.push(next); }
          } else if (nextColor === undefined) { liberties.add(nextKey); }
        }
      }
    }
    return { stones, liberties };
  }
  
  private getGroupAndLiberties(pos: Position) { return this.getGroupAndLibertiesFromMap(this.board, pos); }

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
        groups.push({ id: leaderKey, player, stones: stoneList, expression: this.groupExpressions.get(leaderKey)! });
        stones.forEach(s => visited.add(s));
    }
    return groups;
  }
  
  getScore(): { black: number, white: number } {
      let b = 0, w = 0;
      this.board.forEach((val) => { if (val === Player.Black) b++; else w++; });
      return { black: b, white: w };
  }
}