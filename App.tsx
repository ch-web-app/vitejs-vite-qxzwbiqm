import React, { useState, useEffect, useRef } from 'react';
import { BoardState, GameMode, Player, Position, BOARD_SIZES, posKey } from './types';
import { GoBoard } from './components/GoBoard';
import { executeMove, getAIThinkingMove } from './services/goLogic';
import { Wifi, Cpu, User, ArrowLeft, Copy, CheckCircle2, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  // Game State
  const [board, setBoard] = useState<BoardState>(new Map());
  const [size, setSize] = useState<number>(9);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(Player.Black);
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  
  // Network State
  const [peerId, setPeerId] = useState<string>('');
  const [remotePeerId, setRemotePeerId] = useState<string>('');
  const [conn, setConn] = useState<any>(null);
  const [netStatus, setNetStatus] = useState<string>('');
  const [myNetPlayer, setMyNetPlayer] = useState<Player | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  
  const peerRef = useRef<any>(null);

  // --- Game Logic ---

  const resetGame = (newSize: number = size) => {
    setBoard(new Map());
    setCurrentPlayer(Player.Black);
    setIsThinking(false);
    setSize(newSize);
  };

  const handlePlaceStone = (pos: Position) => {
    const { newBoard, captured, valid } = executeMove(board, size, pos, currentPlayer);
    
    if (valid) {
      // Update Board
      setBoard(newBoard);

      // If online, send move AND the player color explicitly
      if (conn && (gameMode === GameMode.OnlineHost || gameMode === GameMode.OnlineJoin)) {
        conn.send({ type: 'MOVE', pos, player: currentPlayer });
      }
      
      // Switch Turn logic
      if (gameMode === GameMode.AI) {
        setIsThinking(true);
        setCurrentPlayer(Player.White);
        
        // AI Turn
        setTimeout(() => {
          const aiMove = getAIThinkingMove(newBoard, size);
          if (aiMove) {
             const aiResult = executeMove(newBoard, size, aiMove, Player.White);
             setBoard(aiResult.newBoard);
          }
          setCurrentPlayer(Player.Black);
          setIsThinking(false);
        }, 600);
      } else {
        // Local or Online PvP
        setCurrentPlayer(prev => prev === Player.Black ? Player.White : Player.Black);
      }
    }
  };

  // --- Network Logic ---

  const initPeer = (mode: GameMode) => {
    // 1. Clean up existing peer
    if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
    }

    setNetStatus('Initializing Network...');

    // 2. Generate a local ID to reduce server load/errors
    const localId = 'cutego-' + Math.random().toString(36).substr(2, 6);

    const peerConfig = {
      debug: 1, 
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    };

    try {
        const newPeer = new window.Peer(localId, peerConfig);
        peerRef.current = newPeer;

        newPeer.on('open', (id: string) => {
          console.log('My Peer ID is: ' + id);
          setPeerId(id);
          setNetStatus(mode === GameMode.OnlineHost ? 'Waiting for opponent...' : 'Ready to join...');
        });

        newPeer.on('connection', (connection: any) => {
          if (mode === GameMode.OnlineHost) {
            setNetStatus('Connecting to opponent...');
            setupConnection(connection, () => {
                setNetStatus('Connected!');
                setMyNetPlayer(Player.Black);
                connection.send({ type: 'START', size, player: Player.White });
            });
          }
        });

        newPeer.on('error', (err: any) => {
          console.error('Peer error:', err);
          if (err.type === 'unavailable-id') {
              initPeer(mode);
          } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'browser-incompatible') {
              setNetStatus(`Network Error (${err.type}). Please Retry.`);
          } else {
              console.warn("Minor peer error", err);
          }
        });
        
        newPeer.on('disconnected', () => {
             if (peerRef.current && !peerRef.current.destroyed) {
                 peerRef.current.reconnect();
             }
        });

    } catch (e) {
        setNetStatus('Failed to load PeerJS');
        console.error(e);
    }
  };

  const joinGame = () => {
    if (!remotePeerId || !peerRef.current) return;
    
    const cleanId = remotePeerId.trim();
    if (!cleanId) return;

    setNetStatus('Connecting...');
    
    try {
        const connection = peerRef.current.connect(cleanId, { reliable: true });
        
        if (!connection) {
            setNetStatus('Connection Failed (local)');
            return;
        }

        setupConnection(connection, () => {
            setNetStatus('Connected! Waiting for host...');
        });
    } catch (e) {
        console.error(e);
        setNetStatus('Connection Failed');
    }
  };

  const setupConnection = (connection: any, onOpen?: () => void) => {
    setConn(connection);

    const handleOpen = () => {
      console.log("Connection established");
      if (onOpen) onOpen();
    };

    if (connection.open) {
      handleOpen();
    } else {
      connection.on('open', handleOpen);
    }

    connection.on('data', (data: any) => {
      if (data.type === 'START') {
        setSize(data.size);
        setMyNetPlayer(data.player);
        setNetStatus('Game Started!');
        resetGame(data.size);
      } else if (data.type === 'MOVE') {
         // Now we accept the explicit player color from the message
         handleRemoteMove(data.pos, data.player);
      } else if (data.type === 'SYNC_SIZE') {
          setSize(data.size);
          resetGame(data.size);
      }
    });
    
    connection.on('close', () => {
        setNetStatus('Peer Disconnected');
        setConn(null);
    });

    connection.on('error', (err: any) => {
        console.error("Connection Error:", err);
        setNetStatus('Conn Error');
    });
  };

  // Fixed: Accept explicit player type to avoid state inference issues
  const handleRemoteMove = (pos: Position, playerWhoMoved: Player) => {
     setBoard(currentBoard => {
         const res = executeMove(currentBoard, size, pos, playerWhoMoved);
         if (res.valid) {
             // Force update current player to the OTHER player locally
             const nextPlayer = playerWhoMoved === Player.Black ? Player.White : Player.Black;
             setCurrentPlayer(nextPlayer);
             return res.newBoard;
         }
         return currentBoard;
     });
  };

  useEffect(() => {
    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);
  
  useEffect(() => {
     if (gameMode === GameMode.OnlineHost && conn && conn.open) {
         conn.send({ type: 'SYNC_SIZE', size });
         resetGame(size);
     }
  }, [size]);

  // --- UI Renderers ---

  const copyToClipboard = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!gameMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-8">
          <h1 className="text-5xl font-black text-amber-600 tracking-tight font-rounded">CuteGo</h1>
          <p className="text-gray-500 font-bold">选择模式</p>
          
          <div className="space-y-4">
            <button 
              onClick={() => { setGameMode(GameMode.Local); resetGame(); }}
              className="w-full flex items-center justify-center gap-3 p-4 bg-amber-100 text-amber-800 rounded-xl font-bold hover:bg-amber-200 transition-colors"
            >
              <User /> 双人同屏
            </button>
            <button 
               onClick={() => { setGameMode(GameMode.AI); resetGame(); }}
              className="w-full flex items-center justify-center gap-3 p-4 bg-blue-100 text-blue-800 rounded-xl font-bold hover:bg-blue-200 transition-colors"
            >
              <Cpu /> 挑战 AI
            </button>
            <div className="grid grid-cols-2 gap-4">
                <button 
                   onClick={() => { setGameMode(GameMode.OnlineHost); initPeer(GameMode.OnlineHost); resetGame(); }}
                  className="flex flex-col items-center gap-2 p-4 bg-purple-100 text-purple-800 rounded-xl font-bold hover:bg-purple-200 transition-colors"
                >
                  <Wifi /> 创建房间
                </button>
                <button 
                   onClick={() => { setGameMode(GameMode.OnlineJoin); initPeer(GameMode.OnlineJoin); resetGame(); }}
                  className="flex flex-col items-center gap-2 p-4 bg-purple-100 text-purple-800 rounded-xl font-bold hover:bg-purple-200 transition-colors"
                >
                  <Wifi /> 加入房间
                </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const blackScore = Array.from(board.values()).filter(p => p === Player.Black).length;
  const whiteScore = Array.from(board.values()).filter(p => p === Player.White).length;

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      <div className="bg-white px-6 py-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
            <button onClick={() => { 
                if(peerRef.current) peerRef.current.destroy(); 
                setGameMode(null); 
                setConn(null);
            }} className="p-2 hover:bg-gray-100 rounded-full">
                <ArrowLeft className="text-gray-600" />
            </button>
            <h1 className="text-2xl font-black text-gray-800 hidden sm:block">CuteGo</h1>
        </div>

        <div className="flex gap-6 text-sm font-bold bg-gray-100 px-4 py-2 rounded-full">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-900"></div>
                <span>{blackScore}</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-white border border-gray-300"></div>
                <span>{whiteScore}</span>
            </div>
        </div>

        <div className="flex items-center gap-4">
             {gameMode !== GameMode.OnlineJoin && (
                 <select 
                    value={size} 
                    onChange={(e) => {
                        const s = parseInt(e.target.value);
                        setSize(s);
                        resetGame(s);
                    }}
                    disabled={gameMode === GameMode.OnlineHost && !!conn} 
                    className="bg-gray-100 font-bold text-gray-700 text-sm py-2 px-3 rounded-lg border-none focus:ring-2 focus:ring-amber-500"
                 >
                    {BOARD_SIZES.map(s => <option key={s} value={s}>{s}x{s}</option>)}
                 </select>
             )}
        </div>
      </div>

      {(gameMode === GameMode.OnlineHost || gameMode === GameMode.OnlineJoin) && !conn && (
          <div className="bg-purple-50 p-4 text-center border-b border-purple-100 animate-in fade-in slide-in-from-top-4">
              <p className={`font-bold mb-2 ${netStatus.includes('Error') ? 'text-red-600' : 'text-purple-900'}`}>{netStatus}</p>
              
              {netStatus.includes('Error') && (
                   <button 
                     onClick={() => initPeer(gameMode)}
                     className="flex items-center gap-2 mx-auto bg-white text-red-600 px-4 py-2 rounded-lg border border-red-200 shadow-sm hover:bg-red-50 font-bold mb-4"
                   >
                     <RefreshCw size={16} /> 重试连接
                   </button>
              )}

              {gameMode === GameMode.OnlineHost && peerId && !netStatus.includes('Error') && (
                  <div className="flex flex-col items-center gap-2">
                      <div className="text-sm text-purple-700 mb-1">将此 ID 发送给朋友：</div>
                      <div className="flex items-center justify-center gap-2">
                          <code className="bg-white px-3 py-2 rounded border border-purple-200 text-purple-800 font-mono text-lg">{peerId}</code>
                          <button onClick={copyToClipboard} className="text-purple-600 hover:bg-purple-100 p-2 rounded bg-white border border-purple-200">
                              {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                          </button>
                      </div>
                  </div>
              )}
              {gameMode === GameMode.OnlineJoin && !netStatus.includes('Error') && (
                  <div className="flex justify-center gap-2 mt-2">
                      <input 
                        value={remotePeerId}
                        onChange={e => setRemotePeerId(e.target.value)}
                        placeholder="输入房主 ID"
                        className="px-3 py-1 rounded border border-purple-300 focus:outline-purple-500"
                      />
                      <button onClick={joinGame} className="bg-purple-600 text-white px-4 py-1 rounded font-bold hover:bg-purple-700">连接</button>
                  </div>
              )}
          </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="mb-6 text-xl font-bold text-gray-600 flex items-center gap-2 h-8">
            {isThinking ? (
                <span className="text-blue-500 animate-pulse">AI 正在思考 ( •̀ ω •́ )</span>
            ) : (
                <>
                   <span>轮到:</span>
                   <span className={`px-3 py-1 rounded-full text-white text-sm ${currentPlayer === Player.Black ? 'bg-gray-800' : 'bg-gray-400'}`}>
                     {currentPlayer === Player.Black ? "黑子" : "白子"}
                   </span>
                   {myNetPlayer && (
                       <span className="text-xs text-gray-400 ml-2">
                           (你是 {myNetPlayer === Player.Black ? "黑子" : "白子"})
                       </span>
                   )}
                </>
            )}
        </div>

        <GoBoard 
            size={size} 
            board={board} 
            onPlaceStone={handlePlaceStone}
            currentPlayer={currentPlayer}
            isThinking={isThinking}
            gameMode={gameMode}
            myPlayerType={myNetPlayer}
        />

        <div className="mt-8 flex gap-4">
            <button 
                onClick={() => resetGame()} 
                className="px-6 py-2 bg-amber-200 text-amber-900 rounded-full font-bold hover:bg-amber-300 transition-transform active:scale-95"
            >
                重置棋盘
            </button>
        </div>
      </div>
    </div>
  );
};

export default App;
