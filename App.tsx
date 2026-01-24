import React, { useState, useEffect, useRef } from 'react';
import { BoardState, GameMode, Player, Position, BOARD_SIZES, posKey } from './types';
import { GoBoard } from './components/GoBoard';
import { executeMove, getAIThinkingMove } from './services/goLogic';
import { Wifi, Cpu, User, ArrowLeft, Copy, CheckCircle2 } from 'lucide-react';

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

      // If online, send move
      if (conn && (gameMode === GameMode.OnlineHost || gameMode === GameMode.OnlineJoin)) {
        conn.send({ type: 'MOVE', pos });
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
    if (peerRef.current) peerRef.current.destroy();

    // Use a random ID for host, or let PeerJS assign one
    const newPeer = new window.Peer(null, { debug: 2 });
    peerRef.current = newPeer;

    newPeer.on('open', (id: string) => {
      setPeerId(id);
      setNetStatus(mode === GameMode.OnlineHost ? 'Waiting for opponent...' : 'Ready to join...');
    });

    newPeer.on('connection', (connection: any) => {
      if (mode === GameMode.OnlineHost) {
        setNetStatus('Connecting to opponent...');
        // Pass a callback to run ONLY when connection is fully OPEN
        setupConnection(connection, () => {
            setNetStatus('Connected!');
            setMyNetPlayer(Player.Black);
            // Send initial config safely
            connection.send({ type: 'START', size, player: Player.White });
        });
      }
    });

    newPeer.on('error', (err: any) => {
      console.error(err);
      setNetStatus('Connection Error: ' + err.type);
    });
  };

  const joinGame = () => {
    if (!remotePeerId || !peerRef.current) return;
    
    // IMPORTANT: Trim whitespace to prevent ID mismatch errors
    const cleanId = remotePeerId.trim();
    if (!cleanId) return;

    setNetStatus('Connecting...');
    const connection = peerRef.current.connect(cleanId, { reliable: true });
    
    setupConnection(connection, () => {
        setNetStatus('Connected! Waiting for host...');
    });
  };

  const setupConnection = (connection: any, onOpen?: () => void) => {
    setConn(connection);

    const handleOpen = () => {
      console.log("Connection established");
      if (onOpen) onOpen();
    };

    // Check if already open (race condition fix)
    if (connection.open) {
      handleOpen();
    } else {
      connection.on('open', handleOpen);
    }

    connection.on('data', (data: any) => {
      if (data.type === 'START') {
        setSize(data.size);
        setMyNetPlayer(data.player); // Usually White for joiner
        setNetStatus('Game Started!');
        resetGame(data.size);
      } else if (data.type === 'MOVE') {
         handleRemoteMove(data.pos);
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

  // Helper to handle remote move avoiding closure staleness
  const handleRemoteMove = (pos: Position) => {
     setBoard(currentBoard => {
         // Determine who moved. If I am Black, remote is White.
         let mover = Player.Black;
         setMyNetPlayer(me => {
             if (me) mover = me === Player.Black ? Player.White : Player.Black;
             return me;
         });
         
         const res = executeMove(currentBoard, size, pos, mover);
         if (res.valid) {
             setCurrentPlayer(mover === Player.Black ? Player.White : Player.Black);
             return res.newBoard;
         }
         return currentBoard;
     });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);
  
  // Re-sync size changes if hosting
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
          <p className="text-gray-500 font-bold">Select a Mode</p>
          
          <div className="space-y-4">
            <button 
              onClick={() => { setGameMode(GameMode.Local); resetGame(); }}
              className="w-full flex items-center justify-center gap-3 p-4 bg-amber-100 text-amber-800 rounded-xl font-bold hover:bg-amber-200 transition-colors"
            >
              <User /> Pass & Play
            </button>
            <button 
               onClick={() => { setGameMode(GameMode.AI); resetGame(); }}
              className="w-full flex items-center justify-center gap-3 p-4 bg-blue-100 text-blue-800 rounded-xl font-bold hover:bg-blue-200 transition-colors"
            >
              <Cpu /> vs AI
            </button>
            <div className="grid grid-cols-2 gap-4">
                <button 
                   onClick={() => { setGameMode(GameMode.OnlineHost); initPeer(GameMode.OnlineHost); resetGame(); }}
                  className="flex flex-col items-center gap-2 p-4 bg-purple-100 text-purple-800 rounded-xl font-bold hover:bg-purple-200 transition-colors"
                >
                  <Wifi /> Host
                </button>
                <button 
                   onClick={() => { setGameMode(GameMode.OnlineJoin); initPeer(GameMode.OnlineJoin); resetGame(); }}
                  className="flex flex-col items-center gap-2 p-4 bg-purple-100 text-purple-800 rounded-xl font-bold hover:bg-purple-200 transition-colors"
                >
                  <Wifi /> Join
                </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Score Calculation
  const blackScore = Array.from(board.values()).filter(p => p === Player.Black).length;
  const whiteScore = Array.from(board.values()).filter(p => p === Player.White).length;

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      {/* Header */}
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

        {/* Score Board */}
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

        {/* Controls */}
        <div className="flex items-center gap-4">
             {gameMode !== GameMode.OnlineJoin && (
                 <select 
                    value={size} 
                    onChange={(e) => {
                        const s = parseInt(e.target.value);
                        setSize(s);
                        resetGame(s);
                    }}
                    disabled={gameMode === GameMode.OnlineHost && !!conn} // Disable resize if connected for simplicity
                    className="bg-gray-100 font-bold text-gray-700 text-sm py-2 px-3 rounded-lg border-none focus:ring-2 focus:ring-amber-500"
                 >
                    {BOARD_SIZES.map(s => <option key={s} value={s}>{s}x{s}</option>)}
                 </select>
             )}
        </div>
      </div>

      {/* Online Lobby Area */}
      {(gameMode === GameMode.OnlineHost || gameMode === GameMode.OnlineJoin) && !conn && (
          <div className="bg-purple-50 p-4 text-center border-b border-purple-100 animate-in fade-in slide-in-from-top-4">
              <p className="text-purple-900 font-bold mb-2">{netStatus}</p>
              {gameMode === GameMode.OnlineHost && peerId && (
                  <div className="flex items-center justify-center gap-2">
                      <code className="bg-white px-3 py-1 rounded border border-purple-200 text-purple-800">{peerId}</code>
                      <button onClick={copyToClipboard} className="text-purple-600 hover:bg-purple-100 p-1 rounded">
                          {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                      </button>
                  </div>
              )}
              {gameMode === GameMode.OnlineJoin && (
                  <div className="flex justify-center gap-2 mt-2">
                      <input 
                        value={remotePeerId}
                        onChange={e => setRemotePeerId(e.target.value)}
                        placeholder="Enter Host ID"
                        className="px-3 py-1 rounded border border-purple-300 focus:outline-purple-500"
                      />
                      <button onClick={joinGame} className="bg-purple-600 text-white px-4 py-1 rounded font-bold hover:bg-purple-700">Connect</button>
                  </div>
              )}
          </div>
      )}

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        
        {/* Status Indicator */}
        <div className="mb-6 text-xl font-bold text-gray-600 flex items-center gap-2 h-8">
            {isThinking ? (
                <span className="text-blue-500 animate-pulse">AI is thinking ( •̀ ω •́ )</span>
            ) : (
                <>
                   <span>Turn:</span>
                   <span className={`px-3 py-1 rounded-full text-white text-sm ${currentPlayer === Player.Black ? 'bg-gray-800' : 'bg-gray-400'}`}>
                     {currentPlayer === Player.Black ? "Black" : "White"}
                   </span>
                   {myNetPlayer && (
                       <span className="text-xs text-gray-400 ml-2">
                           (You are {myNetPlayer})
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
                Reset Board
            </button>
        </div>
      </div>
    </div>
  );
};

export default App;
