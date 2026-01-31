
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BoardState, GameMode, Player, Position, BOARD_SIZES, posKey, BoardHistory, AiLevel, ScoredMove } from './types';
import { GoBoard } from './components/GoBoard';
import { executeMove, getAIThinkingMove, analyzeTerritory, generateLocalAnalysis } from './services/goLogic';
import { Wifi, Cpu, User, ArrowLeft, RefreshCw, Undo2, Timer, Trophy, XCircle, SkipForward, Copy, CheckCircle2, ChevronRight, Zap, Grid3X3, Eye, Sparkles, BrainCircuit, MessageSquareQuote, HelpCircle, Link as LinkIcon, Users, Map as MapIcon, Minimize2 } from 'lucide-react';

const KOMI = 6.5;
const MERCY_THRESHOLD = 25; 

const App: React.FC = () => {
  const [board, setBoard] = useState<BoardState>(new Map());
  const [size, setSize] = useState<number>(9);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(Player.Black);
  const [userPreferredColor, setUserPreferredColor] = useState<Player>(Player.Black);
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [aiLevel, setAiLevel] = useState<AiLevel>(AiLevel.Medium);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [aiCandidates, setAiCandidates] = useState<ScoredMove[]>([]);
  const [lastMove, setLastMove] = useState<Position | null>(null);
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  // 新增：控制结算弹窗的显示/隐藏，以便进行复盘
  const [showResultModal, setShowResultModal] = useState(false);
  const [passCount, setPassCount] = useState(0); 
  const [winReason, setWinReason] = useState<string>('');
  const [gameAnalysis, setGameAnalysis] = useState<string>('');
  const [history, setHistory] = useState<BoardHistory[]>([]);
  const [undoCounts, setUndoCounts] = useState({ [Player.Black]: 3, [Player.White]: 3 });
  const [timeLeft, setTimeLeft] = useState(15);
  
  // 联网相关状态
  const [peerId, setPeerId] = useState<string>('');
  const [remotePeerId, setRemotePeerId] = useState<string>('');
  const [conn, setConn] = useState<any>(null);
  const [netStatus, setNetStatus] = useState<'idle' | 'waiting' | 'connected' | 'error'>('idle');
  const [myNetPlayer, setMyNetPlayer] = useState<Player | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [showWaitingModal, setShowWaitingModal] = useState<boolean>(true);

  const [persistentGuidance, setPersistentGuidance] = useState<boolean>(false);
  const [showGuidancePrompt, setShowGuidancePrompt] = useState<boolean>(false);
  const [guidanceDecisionMade, setGuidanceDecisionMade] = useState<boolean>(false);
  
  const peerRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);

  const scoringData = useMemo(() => {
    const tMap = analyzeTerritory(board, size);
    let bStones = 0, wStones = 0, bTerritory = 0, wTerritory = 0;
    board.forEach(p => p === Player.Black ? bStones++ : wStones++);
    tMap.forEach(owner => {
        if (owner === Player.Black) bTerritory++;
        else if (owner === Player.White) wTerritory++;
    });
    const bTotal = bStones + bTerritory;
    const wTotal = wStones + wTerritory + KOMI;
    return { bStones, wStones, bTerritory, wTerritory, bTotal, wTotal };
  }, [board, size]);

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const endGame = useCallback((reason: string, manualWinner?: Player | 'Draw') => {
    stopTimer();
    setWinReason(reason);
    setIsGameOver(true);
    setShowResultModal(true); // 游戏结束时自动显示弹窗
    const b = scoringData.bTotal;
    const w = scoringData.wTotal;
    const targetWinner = manualWinner || (b > w ? Player.Black : w > b ? Player.White : 'Draw');
    setWinner(targetWinner);
    setGameAnalysis(generateLocalAnalysis(targetWinner, b, w, board, size));
  }, [board, scoringData, size]);

  const checkAutoEndConditions = useCallback((currentBoard: BoardState) => {
    const b = scoringData.bTotal;
    const w = scoringData.wTotal;
    if (history.length > (size * size * 0.7) && Math.abs(b - w) > MERCY_THRESHOLD) {
      endGame('优势巨大，系统自动终结');
      return true;
    }
    return false;
  }, [history.length, size, scoringData, endGame]);

  // PeerJS 初始化与监听
  useEffect(() => {
    if (gameMode === GameMode.OnlineHost || gameMode === GameMode.OnlineJoin) {
      const peer = new window.Peer();
      peerRef.current = peer;

      peer.on('open', (id: string) => {
        setPeerId(id);
        if (gameMode === GameMode.OnlineHost) setNetStatus('waiting');
      });

      peer.on('connection', (c: any) => {
        if (gameMode === GameMode.OnlineHost) {
          c.on('open', () => {
            setConn(c);
            setNetStatus('connected');
            setMyNetPlayer(userPreferredColor);
            c.send({ type: 'INIT', size, hostColor: userPreferredColor });
          });
          setupConnectionListeners(c);
        }
      });

      peer.on('error', () => setNetStatus('error'));

      return () => peer.destroy();
    }
  }, [gameMode]);

  const setupConnectionListeners = (c: any) => {
    c.on('data', (data: any) => {
      if (data.type === 'MOVE') {
        applyMoveLocally(data.pos, data.player);
      } else if (data.type === 'PASS') {
        handlePassLocally();
      } else if (data.type === 'UNDO') {
        handleUndoLocally(data.player);
      } else if (data.type === 'INIT') {
        setSize(data.size);
        setMyNetPlayer(data.hostColor === Player.Black ? Player.White : Player.Black);
        setNetStatus('connected');
      }
    });
    c.on('close', () => setNetStatus('error'));
  };

  const connectToPeer = () => {
    if (!remotePeerId || !peerRef.current) return;
    const c = peerRef.current.connect(remotePeerId);
    setConn(c);
    c.on('open', () => {
      setNetStatus('connected');
      setupConnectionListeners(c);
    });
  };

  const applyMoveLocally = useCallback((pos: Position, player: Player) => {
    const prevBoard = history.length > 0 ? history[history.length - 1].board : null;
    const { newBoard, valid } = executeMove(board, size, pos, player, prevBoard);
    if (valid) {
      setAiCandidates([]); 
      setPassCount(0);
      setHistory(prev => [...prev, { board: new Map(board), player: player, lastMove }]);
      setBoard(newBoard);
      setLastMove(pos);
      setTimeLeft(15);
      setCurrentPlayer(player === Player.Black ? Player.White : Player.Black);
      checkAutoEndConditions(newBoard);
    }
  }, [board, size, lastMove, checkAutoEndConditions, history]);

  const handlePassLocally = useCallback(() => {
    const nextPass = passCount + 1;
    setPassCount(nextPass);
    if (nextPass >= 2) endGame('双方停手，终局结算');
    else {
      setCurrentPlayer(p => p === Player.Black ? Player.White : Player.Black);
      setTimeLeft(15);
    }
  }, [passCount, endGame]);

  const handleUndoLocally = useCallback((p: Player, steps: number = 1) => {
    if (history.length < steps) return;
    
    const targetIndex = history.length - steps;
    const targetState = history[targetIndex];
    
    setBoard(new Map(targetState.board));
    setLastMove(targetState.lastMove);
    setCurrentPlayer(targetState.player);
    setHistory(h => h.slice(0, -steps));
    setUndoCounts(prev => ({...prev, [p]: prev[p] - 1}));
    setTimeLeft(15);
    setAiCandidates([]); 
  }, [history]);

  const handlePlaceStone = useCallback((pos: Position) => {
    if (isGameOver || isThinking) return;
    if ((gameMode === GameMode.OnlineHost || gameMode === GameMode.OnlineJoin) && currentPlayer !== myNetPlayer) return;

    // Get the board state BEFORE the current board (i.e., state before opponent moved) for Ko check
    const prevBoard = history.length > 0 ? history[history.length - 1].board : null;
    const { newBoard, valid } = executeMove(board, size, pos, currentPlayer, prevBoard);
    
    if (valid) {
      if (conn) conn.send({ type: 'MOVE', pos, player: currentPlayer });
      
      setAiCandidates([]); 
      setPassCount(0);
      setHistory(prev => [...prev, { board: new Map(board), player: currentPlayer, lastMove }]);
      setBoard(newBoard);
      setLastMove(pos);
      setTimeLeft(15);
      
      if (!checkAutoEndConditions(newBoard)) {
         setCurrentPlayer(currentPlayer === Player.Black ? Player.White : Player.Black);

         if (gameMode === GameMode.AI) {
            const aiColor = userPreferredColor === Player.Black ? Player.White : Player.Black;
            setIsThinking(true);
            
            setTimeout(() => {
              const koConstraintBoard = board; 
              // Pass current history to AI so it can check Opening Books
              const { move: aiMove } = getAIThinkingMove(newBoard, size, aiLevel, pos, aiColor, koConstraintBoard, [...history, { board: new Map(board), player: currentPlayer, lastMove: pos }]);
              if (aiMove) {
                const aiRes = executeMove(newBoard, size, aiMove, aiColor, koConstraintBoard);
                if (aiRes.valid) {
                   setBoard(aiRes.newBoard);
                   setLastMove(aiMove);
                   setHistory(h => [...h, { board: new Map(newBoard), player: aiColor, lastMove: pos }]);
                   setCurrentPlayer(aiColor === Player.Black ? Player.White : Player.Black);
                   checkAutoEndConditions(aiRes.newBoard);
                }
              } else {
                setPassCount(p => p + 1);
                setCurrentPlayer(aiColor === Player.Black ? Player.White : Player.Black);
              }
              setIsThinking(false);
              setTimeLeft(15);
            }, 800);
         }
      }
    }
  }, [board, size, currentPlayer, isGameOver, isThinking, conn, gameMode, myNetPlayer, userPreferredColor, aiLevel, lastMove, checkAutoEndConditions, history]);

  const handlePass = useCallback(() => {
    if (isGameOver || isThinking) return;
    if ((gameMode === GameMode.OnlineHost || gameMode === GameMode.OnlineJoin) && currentPlayer !== myNetPlayer) return;
    
    if (conn) conn.send({ type: 'PASS' });
    handlePassLocally();
  }, [isGameOver, isThinking, conn, gameMode, myNetPlayer, currentPlayer, handlePassLocally]);

  const handleUndo = useCallback((p: Player) => {
    if (isGameOver || history.length === 0 || !!conn || isThinking) return;
    if (undoCounts[p] <= 0) return;
    
    if (gameMode === GameMode.AI) {
        // 在AI模式下，通常需要回退2步（AI的一步和玩家的一步），回到玩家的回合
        const steps = history.length >= 2 ? 2 : 1;
        handleUndoLocally(p, steps);
    } else {
        handleUndoLocally(p, 1);
    }
  }, [isGameOver, history.length, conn, undoCounts, handleUndoLocally, gameMode, isThinking]);

  useEffect(() => {
    // If game is over, we definitely want to clear candidates regardless of persistentGuidance
    if (isGameOver) {
        if (aiCandidates.length > 0) setAiCandidates([]);
        return;
    }

    const isUserTurn = gameMode === GameMode.AI && currentPlayer === userPreferredColor;
    if (!isUserTurn || (aiLevel !== AiLevel.Easy && !persistentGuidance) || isThinking) {
      if (!isThinking && aiCandidates.length > 0 && !persistentGuidance) {
        setAiCandidates([]);
      }
      return;
    }

    // Use history.length to check for total moves. 
    // This ensures consistent behavior even if stones are captured (which reduces board.size).
    // It also handles the case where the AI (Player 1 if user is White) makes the 21st move, 
    // pushing the count past 20 before the user's turn.
    if (history.length >= 20 && !guidanceDecisionMade && !showGuidancePrompt && aiLevel === AiLevel.Easy) {
       setShowGuidancePrompt(true);
    }

    const shouldShowGuidance = (aiLevel === AiLevel.Easy && history.length < 20) || persistentGuidance;
    if (shouldShowGuidance) {
      // For guidance, we want the AI to suggest a move for the CURRENT player.
      // The Ko constraint is the board state before the opponent moved.
      const koConstraint = history.length > 0 ? history[history.length - 1].board : null;
      // Pass history to allow opening book guidance
      const { candidates } = getAIThinkingMove(board, size, AiLevel.Hard, lastMove, userPreferredColor, koConstraint, history);
      setAiCandidates(candidates);
    }
  }, [board, currentPlayer, aiLevel, gameMode, isGameOver, isThinking, lastMove, persistentGuidance, guidanceDecisionMade, showGuidancePrompt, size, userPreferredColor, history]);

  const startNewGame = (mode: GameMode) => {
    stopTimer();
    setIsThinking(false);
    setGameMode(mode);
    setBoard(new Map());
    setHistory([]);
    setUndoCounts({ [Player.Black]: 3, [Player.White]: 3 });
    setLastMove(null);
    setTimeLeft(15);
    setWinner(null);
    setIsGameOver(false);
    setShowResultModal(false); // 重置弹窗状态
    setShowWaitingModal(true); // 重置等待弹窗
    setPassCount(0);
    setWinReason('');
    setGameAnalysis('');
    setPersistentGuidance(false);
    setShowGuidancePrompt(false);
    setGuidanceDecisionMade(false);
    setCurrentPlayer(Player.Black);
  };

  useEffect(() => {
    if (gameMode === GameMode.AI && userPreferredColor === Player.White && history.length === 0 && currentPlayer === Player.Black) {
      if (isThinking) return;

      setIsThinking(true);
      const timer = setTimeout(() => {
          const emptyBoard = new Map<string, Player>();
          // No history yet, so no Ko constraint. Pass empty history.
          const { move: aiMove } = getAIThinkingMove(emptyBoard, size, aiLevel, null, Player.Black, null, []);
          
          if (aiMove) {
              const aiRes = executeMove(emptyBoard, size, aiMove, Player.Black, null);
              setBoard(aiRes.newBoard);
              setLastMove(aiMove);
              setHistory([{ board: new Map(emptyBoard), player: Player.Black, lastMove: null }]);
              setCurrentPlayer(Player.White);
          }
          setIsThinking(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [gameMode, userPreferredColor, history.length, currentPlayer, size, aiLevel]);

  const copyId = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!gameMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 p-4">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-md w-full text-center space-y-6 border-b-[12px] border-amber-100">
          <h1 className="text-7xl font-black text-amber-600 tracking-tighter mb-4">YY Go</h1>
          
          <div className="bg-amber-100/50 p-2 rounded-[2rem] flex items-center gap-1 shadow-inner">
             {BOARD_SIZES.map(s => (
               <button key={s} onClick={() => setSize(s)}
                className={`flex-1 py-3 rounded-[1.5rem] font-black transition-all ${size === s ? 'bg-white text-amber-600 shadow-sm scale-[1.05]' : 'text-amber-400 hover:text-amber-500'}`}
               >{s}x{s}</button>
             ))}
          </div>

          <div className="bg-gray-100 p-2 rounded-[2rem] flex items-center gap-1 shadow-inner border-2 border-white">
            <button onClick={() => setUserPreferredColor(Player.Black)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.5rem] font-black transition-all ${userPreferredColor === Player.Black ? 'bg-gray-900 text-white shadow-xl scale-[1.05]' : 'text-gray-400'}`}>黑子 (先手)</button>
            <button onClick={() => setUserPreferredColor(Player.White)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.5rem] font-black transition-all ${userPreferredColor === Player.White ? 'bg-white text-gray-900 shadow-xl scale-[1.05]' : 'text-gray-400'}`}>白子 (后手)</button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button onClick={() => startNewGame(GameMode.Local)} className="w-full flex items-center justify-center gap-4 p-5 bg-amber-100 text-amber-800 rounded-3xl font-black text-xl hover:scale-[1.02] transition-all shadow-md group">
              <User size={28} /> 同屏对局
            </button>
            
            <div className="bg-blue-50 p-5 rounded-3xl space-y-3 shadow-inner border-2 border-blue-100/50">
              <div className="flex items-center justify-between px-2 text-blue-800 font-black"><div className="flex items-center gap-2"><Cpu size={22}/> AI 对战</div><div className="flex gap-1">{[AiLevel.Easy, AiLevel.Medium, AiLevel.Hard].map(l => <button key={l} onClick={() => setAiLevel(l)} className={`px-2 py-1 rounded-full text-[10px] ${aiLevel === l ? 'bg-blue-600 text-white' : 'bg-white text-blue-300'}`}>{l}</button>)}</div></div>
              <button onClick={() => startNewGame(GameMode.AI)} className="w-full p-4 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-lg">开始对弈</button>
            </div>

            <div className="bg-cyan-50 p-5 rounded-3xl space-y-3 shadow-inner border-2 border-cyan-100/50">
              <div className="flex items-center gap-2 text-cyan-800 font-black px-2"><Users size={22}/> 联网对战</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => startNewGame(GameMode.OnlineHost)} className="p-4 bg-cyan-600 text-white rounded-2xl font-black text-lg shadow-lg">创建房间</button>
                <button onClick={() => startNewGame(GameMode.OnlineJoin)} className="p-4 bg-white text-cyan-600 border-2 border-cyan-100 rounded-2xl font-black text-lg shadow-md">加入房间</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF7] flex flex-col font-rounded overflow-hidden">
      {showGuidancePrompt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
           <div className="bg-white p-8 rounded-[3rem] shadow-2xl text-center space-y-6 max-w-sm w-full border-b-[12px] border-cyan-100">
              <div className="w-20 h-20 bg-cyan-100 rounded-full flex items-center justify-center mx-auto text-cyan-600"><MessageSquareQuote size={40} /></div>
              <h3 className="text-xl font-black text-gray-800">10步引导结束</h3>
              <p className="text-gray-500 text-sm">是否需要 AI 继续为你指点迷津，直到本局结束？</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => { setPersistentGuidance(true); setGuidanceDecisionMade(true); setShowGuidancePrompt(false); }} className="p-4 bg-cyan-600 text-white rounded-2xl font-black text-lg shadow-lg flex items-center justify-center gap-2"><Zap size={20} /> 开启全程指导</button>
                <button onClick={() => { setGuidanceDecisionMade(true); setShowGuidancePrompt(false); }} className="p-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-lg">我自己来</button>
              </div>
           </div>
        </div>
      )}

      {(gameMode === GameMode.OnlineHost && netStatus === 'waiting' && showWaitingModal) && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md p-6">
           <div className="bg-white p-10 rounded-[4rem] shadow-2xl text-center space-y-6 max-w-sm w-full relative">
              <button 
                onClick={() => setShowWaitingModal(false)}
                className="absolute top-8 right-8 text-gray-400 hover:text-gray-600 transition-colors"
                title="最小化"
              >
                <Minimize2 size={24} />
              </button>
              
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600 animate-pulse"><LinkIcon size={40} /></div>
              <h3 className="text-2xl font-black">房间已创建</h3>
              <p className="text-gray-500">将下方 ID 发送给好友以开始对局：</p>
              <div onClick={copyId} className="p-4 bg-gray-50 rounded-3xl border-2 border-dashed border-amber-200 font-mono font-bold text-amber-800 flex items-center justify-between cursor-pointer active:scale-95 transition-all">
                {peerId.slice(0, 8)}... {copied ? <CheckCircle2 size={20} className="text-green-500" /> : <Copy size={20} />}
              </div>
              
              <div className="flex flex-col gap-3">
                 <button onClick={() => setShowWaitingModal(false)} className="w-full p-4 bg-amber-500 text-white rounded-2xl font-black text-lg shadow-lg">进入棋盘等待</button>
                 <button onClick={() => setGameMode(null)} className="text-gray-400 font-bold hover:text-red-500 transition-colors">取消创建</button>
              </div>
           </div>
        </div>
      )}

      {(gameMode === GameMode.OnlineHost && netStatus === 'waiting' && !showWaitingModal) && (
        <div className="fixed top-24 z-[90] bg-white/90 backdrop-blur-md border-2 border-amber-200 shadow-xl px-5 py-3 rounded-full flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
             <div className="flex items-center gap-2">
                 <span className="relative flex h-3 w-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                 </span>
                 <span className="text-xs font-black text-amber-800 uppercase tracking-wider">等待连接中...</span>
             </div>
             <div className="h-4 w-px bg-amber-200"></div>
             <div className="flex items-center gap-2 font-mono text-amber-900 font-bold">
                 {peerId.slice(0, 6)}...
                 <button onClick={copyId} className="hover:text-amber-600 transition-colors">{copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}</button>
             </div>
             <div className="h-4 w-px bg-amber-200"></div>
             <button onClick={() => setShowWaitingModal(true)} className="text-xs font-bold text-amber-600 hover:text-amber-800">
                查看详情
             </button>
        </div>
      )}

      {gameMode === GameMode.OnlineJoin && netStatus === 'idle' && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md p-6">
           <div className="bg-white p-10 rounded-[4rem] shadow-2xl text-center space-y-6 max-w-sm w-full">
              <div className="w-20 h-20 bg-cyan-100 rounded-full flex items-center justify-center mx-auto text-cyan-600"><Wifi size={40} /></div>
              <h3 className="text-2xl font-black">加入对局</h3>
              <input type="text" placeholder="输入房间 ID" value={remotePeerId} onChange={e => setRemotePeerId(e.target.value)} 
                className="w-full p-5 bg-gray-50 rounded-3xl border-2 border-gray-100 text-center font-black text-lg focus:border-cyan-400 outline-none transition-all" />
              <button onClick={connectToPeer} className="w-full p-5 bg-cyan-600 text-white rounded-3xl font-black text-xl shadow-lg">立即连接</button>
              <button onClick={() => setGameMode(null)} className="text-gray-400 font-bold">返回</button>
           </div>
        </div>
      )}

      {/* 修改：结算弹窗逻辑，由 showResultModal 控制 */}
      {(isGameOver && showResultModal) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-md p-6">
          <div className="bg-white p-8 rounded-[4rem] shadow-2xl text-center space-y-6 max-w-lg w-full my-auto border-b-[16px] border-gray-100">
            <Trophy size={48} className="mx-auto text-amber-600" />
            <h2 className="text-2xl font-black text-gray-800">对局结算</h2>
            <div className={`py-4 px-8 rounded-full shadow-lg ${winner === Player.Black ? 'bg-gray-900 text-white' : winner === Player.White ? 'bg-white border-4 border-gray-200 text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
              <p className="font-black text-2xl">{winner === Player.Black ? '黑子 胜出' : winner === Player.White ? '白子 胜出' : '平局'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-gray-50 p-4 rounded-3xl border-2 border-white text-left"><span className="text-[10px] text-gray-400 font-black uppercase">黑棋得分</span><div className="text-2xl font-black">{scoringData.bTotal.toFixed(1)}</div></div>
               <div className="bg-blue-50 p-4 rounded-3xl border-2 border-white text-left"><span className="text-[10px] text-blue-400 font-black uppercase">白棋得分</span><div className="text-2xl font-black text-blue-600">{scoringData.wTotal.toFixed(1)}</div></div>
            </div>
            <p className="text-amber-800 text-sm leading-relaxed italic bg-amber-50 p-6 rounded-[2.5rem]">{gameAnalysis}</p>
            <div className="grid grid-cols-2 gap-3">
                {/* 新增：复盘按钮 */}
                <button onClick={() => setShowResultModal(false)} className="w-full p-5 bg-blue-100 text-blue-600 rounded-[2rem] font-black text-lg shadow-lg flex items-center justify-center gap-2">
                    <MapIcon size={20} /> 复盘棋局
                </button>
                <button onClick={() => {setGameMode(null); setIsGameOver(false);}} className="w-full p-5 bg-amber-500 text-white rounded-[2rem] font-black text-lg shadow-lg">返回大厅</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/90 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-b-2 border-amber-50">
        <button onClick={() => setGameMode(null)} className="p-3 bg-gray-100 rounded-2xl"><ArrowLeft size={24} /></button>
        <div className="flex gap-6">
          <div className={`flex items-center gap-4 bg-gray-900 text-white px-6 py-2 rounded-full shadow-lg ${currentPlayer === Player.Black ? 'ring-4 ring-amber-400 scale-105' : 'opacity-40'}`}>
            <div className="w-4 h-4 rounded-full bg-white"></div><span className="font-black text-2xl">{scoringData.bTotal.toFixed(0)}</span>
            {myNetPlayer === Player.Black && <span className="text-[10px] text-amber-400 font-black ml-1">您</span>}
          </div>
          <div className={`flex items-center gap-4 bg-white text-gray-900 border-2 border-gray-100 px-6 py-2 rounded-full shadow-lg ${currentPlayer === Player.White ? 'ring-4 ring-amber-400 scale-105' : 'opacity-40'}`}>
            <div className="w-4 h-4 rounded-full bg-gray-300"></div><span className="font-black text-2xl">{scoringData.wTotal.toFixed(1)}</span>
            {myNetPlayer === Player.White && <span className="text-[10px] text-amber-600 font-black ml-1">您</span>}
          </div>
        </div>
        <div className={`p-3 rounded-2xl ${netStatus === 'connected' ? 'text-green-500 bg-green-50' : 'text-gray-300 bg-gray-50'}`}><Wifi size={24} /></div>
      </div>

      <div className="w-full bg-gray-100 h-2">
        <div className="h-full bg-amber-400 transition-all duration-1000" style={{ width: `${(timeLeft / 15) * 100}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6 relative">
        {/* 新增：复盘模式下显示的“查看结果”悬浮按钮 */}
        {(isGameOver && !showResultModal) && (
            <div className="absolute top-2 z-10 animate-bounce">
                <button onClick={() => setShowResultModal(true)} className="px-6 py-2 bg-amber-500 text-white rounded-full font-black shadow-lg flex items-center gap-2">
                    <Trophy size={18} /> 查看结果
                </button>
            </div>
        )}

        <div className="text-center mb-2 animate-in fade-in slide-in-from-top-2 duration-500">
          {isGameOver ? (
             <span className="text-amber-600 font-black text-lg flex items-center justify-center gap-2">
               {winner === 'Draw' ? '平局' : `${winner === Player.Black ? '黑棋' : '白棋'} 获胜`}
             </span>
          ) : isThinking ? (
            <span className="text-blue-500 font-black text-lg animate-pulse flex items-center justify-center gap-2">
              <BrainCircuit size={20} /> AI 正在思考中...
            </span>
          ) : (
            <span className={`font-black text-lg ${currentPlayer === Player.Black ? 'text-gray-900' : 'text-gray-500'}`}>
              轮到 {currentPlayer === Player.Black ? '黑棋' : '白棋'} 落子
              {gameMode === GameMode.AI && currentPlayer === userPreferredColor && " (你)"}
              {gameMode === GameMode.AI && currentPlayer !== userPreferredColor && " (AI)"}
            </span>
          )}
        </div>

        <GoBoard size={size} board={board} onPlaceStone={handlePlaceStone} currentPlayer={currentPlayer} isThinking={isThinking} gameMode={gameMode} lastMove={lastMove} aiCandidates={aiCandidates} isReviewMode={isGameOver && !showResultModal} />
        
        <div className="grid grid-cols-5 items-end gap-4 w-full max-w-md px-4">
            <button onClick={() => handleUndo(Player.Black)} disabled={history.length === 0 || !!conn || isThinking} className="p-4 bg-gray-900 shadow-xl rounded-3xl text-white disabled:opacity-20 border-b-4 border-black"><Undo2 size={24} /></button>
            <div className="col-span-3 flex flex-col gap-3">
              <button onClick={handlePass} disabled={isGameOver || isThinking || (!!conn && currentPlayer !== myNetPlayer)} className="w-full p-4 bg-amber-100 text-amber-900 rounded-[2.5rem] shadow-lg font-black flex items-center justify-center gap-2 border-b-[6px] border-amber-200"><SkipForward size={24} /> 停手 (Pass)</button>
              <button onClick={() => startNewGame(gameMode)} className="w-full py-2 bg-white text-amber-400 rounded-full font-black text-xs border-2 border-amber-50">重新开始</button>
            </div>
            <button onClick={() => handleUndo(Player.White)} disabled={history.length === 0 || !!conn || isThinking} className="p-4 bg-white shadow-xl rounded-3xl text-gray-800 disabled:opacity-20 border-b-4 border-gray-100"><Undo2 size={24} /></button>
        </div>
      </div>
    </div>
  );
};

export default App;
