import React, { useState, useMemo, useEffect } from 'react';
import { GoEngine } from './services/goEngine';
import { getStoredElo, saveElo, calculateRatingChange, getRankLabelFromElo } from './services/elo';
import GoBoard from './components/GoBoard';
import { RankValue, Player } from './types';
import { RotateCcw, Brain, Users, Sparkles, AlertCircle, Trophy, Medal, Flag, CheckCircle2, Wifi, X, Copy, Smartphone, Globe, ArrowRight } from 'lucide-react';

const App: React.FC = () => {
  const [size, setSize] = useState(9);
  const [rank, setRank] = useState<RankValue>("9p"); // Default to strongest AI
  const [tick, setTick] = useState(0); 
  const [userElo, setUserElo] = useState(getStoredElo());
  const [showResultModal, setShowResultModal] = useState(false);
  const [ratingDiff, setRatingDiff] = useState<number | null>(null);
  
  // Menu State
  const [uiTab, setUiTab] = useState<'local' | 'online'>('local');
  const [localMode, setLocalMode] = useState<'pvp' | 'ai'>('pvp');
  const [joinCode, setJoinCode] = useState("");
  
  // Engine instance is stable across renders
  const engine = useMemo(() => new GoEngine(size), []);

  // Sync UI state with Engine state
  useEffect(() => {
    if (uiTab === 'local') {
        if (engine.isNetworkGame) {
            engine.cleanupNetwork();
        }
        engine.isNetworkGame = false;
        engine.isVsAI = (localMode === 'ai');
    } else {
        engine.isVsAI = false;
        // Do not auto-cleanup network here to allow persistence when switching tabs briefly
    }
    setTick(t => t + 1);
  }, [uiTab, localMode, engine]);

  // Update engine configuration when UI state changes
  useEffect(() => {
    // Only reset board on size change if NOT in network game (network handles its own sync)
    if (!engine.isNetworkGame) {
        engine.setupBoard(size);
        setTick(t => t + 1);
    }
    engine.setRank(rank);
    setRatingDiff(null);
  }, [size, engine]);

  useEffect(() => {
    engine.setRank(rank);
  }, [rank, engine]);

  // Listen for network events
  useEffect(() => {
      engine.setNetworkCallback(() => {
          // If synced size changed from network, update UI state
          if (engine.size !== size) {
              setSize(engine.size);
          }
          setTick(t => t + 1);
      });
  }, [engine, size]);

  const handlePlaceStone = (r: number, c: number) => {
    if (showResultModal) return;
    engine.placeStone({ row: r, col: c }, () => {
        setTick(t => t + 1);
    });
  };

  const handleReset = () => {
      if (engine.isNetworkGame) {
          if (confirm("Disconnect from online game?")) {
              engine.cleanupNetwork();
          } else {
              return;
          }
      } else {
          engine.setupBoard(size);
      }
      setRatingDiff(null);
      setShowResultModal(false);
      setTick(t => t + 1);
  };

  const handleHost = () => {
      engine.hostGame(size);
      setTick(t => t + 1);
  };

  const handleJoin = () => {
      if (joinCode.length === 4) {
          engine.joinGame(joinCode);
          setTick(t => t + 1);
      }
  };

  const handleFinishGame = (result: 'win' | 'loss') => {
      if (engine.isNetworkGame) {
          engine.sendResign(); 
      }
      else if (engine.isVsAI && engine.board.size > 2) {
          const change = calculateRatingChange(userElo, rank, result);
          const newElo = userElo + change;
          saveElo(newElo);
          setUserElo(newElo);
          setRatingDiff(change);
      }
      setShowResultModal(true);
  };

  const score = engine.getScore();
  const playerRankLabel = getRankLabelFromElo(userElo);

  // --- Status Message Logic ---
  let statusMessage = null;

  if (engine.lastError) {
      statusMessage = (
         <div className="animate-bounce flex items-center gap-2 text-red-500 bg-red-50 px-3 py-1 rounded-full border border-red-100 text-xs font-bold shadow-sm">
            <AlertCircle size={14} />
            {engine.lastError}
         </div>
      );
  } else if (engine.isThinking) {
      statusMessage = (
         <div className="flex items-center gap-2 text-indigo-500 font-bold animate-pulse">
            <Sparkles size={16} />
            AI Thinking...
         </div>
      );
  } else if (engine.isNetworkGame) {
      if (engine.networkStatus === 'connecting') {
          statusMessage = (
             <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-1.5 rounded-full text-xs font-bold border border-amber-200 animate-pulse">
                <Wifi size={14} />
                {engine.roomId ? `Waiting for Opponent...` : 'Connecting...'}
             </div>
          );
      } else if (engine.networkStatus === 'connected') {
          const isMyTurn = engine.currentPlayer === engine.myNetworkColor;
          statusMessage = (
             <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border shadow-sm ${isMyTurn ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                 <span className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                 {isMyTurn ? "Your Turn" : "Opponent's Turn"}
             </div>
          );
      }
  } else {
      // Local Game Status
      statusMessage = (
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border shadow-sm ${engine.currentPlayer === 'Black' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200'}`}>
           <span className="w-2 h-2 rounded-full bg-current"></span>
           {engine.currentPlayer}'s Turn
        </div>
      );
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100">
      
      {/* Header */}
      <div className="w-full max-w-lg mt-4 mb-4 flex items-center justify-between">
         <div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter" style={{ fontFamily: 'Rounded Mplus 1c, sans-serif' }}>CuteGo</h1>
            <p className="text-sm font-bold text-slate-400 -mt-1 tracking-wide">YQ</p>
         </div>
         {/* Player Profile Card */}
         <div className="flex items-center gap-3 bg-white pl-2 pr-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white shadow-inner">
                 <Users size={16} />
             </div>
             <div className="flex flex-col">
                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">You ({playerRankLabel})</span>
                 <div className="flex items-center gap-1 text-sm font-black text-indigo-600 leading-none">
                     {userElo}
                     {ratingDiff !== null && (
                         <span className={`text-[10px] ${ratingDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                             {ratingDiff >= 0 ? '+' : ''}{ratingDiff}
                         </span>
                     )}
                 </div>
             </div>
         </div>
      </div>

      {/* Main Mode Tabs */}
      <div className="w-full max-w-lg mb-4 grid grid-cols-2 bg-slate-200 p-1 rounded-xl">
          <button 
            onClick={() => setUiTab('local')}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${uiTab === 'local' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
              <Smartphone size={16} /> Local Game
          </button>
          <button 
            onClick={() => setUiTab('online')}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${uiTab === 'online' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
              <Globe size={16} /> Online Game
          </button>
      </div>

      {/* Control Panel */}
      <div className="w-full max-w-lg mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
          
          {/* --- LOCAL MODE SETTINGS --- */}
          {uiTab === 'local' && (
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
                  <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Size</span>
                      <div className="flex bg-slate-100 p-1 rounded-lg">
                          {[9, 13, 19].map(s => (
                              <button 
                                  key={s}
                                  onClick={() => setSize(s)}
                                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${size === s ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                              >
                                  {s}
                              </button>
                          ))}
                      </div>
                  </div>

                  <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button onClick={() => setLocalMode('pvp')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${localMode === 'pvp' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>
                          <Users size={12} /> PvP
                      </button>
                      <button onClick={() => setLocalMode('ai')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${localMode === 'ai' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>
                          <Brain size={12} /> vs AI
                      </button>
                  </div>
              </div>
          )}

          {/* --- ONLINE MODE SETTINGS --- */}
          {uiTab === 'online' && (
              <div className="flex flex-col gap-3">
                  {engine.networkStatus === 'disconnected' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* HOST Section */}
                          <button onClick={handleHost} className="flex flex-col items-center justify-center gap-2 p-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-all group relative overflow-hidden text-left">
                              <div className="absolute inset-0 bg-indigo-200/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                              <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform relative z-10">
                                  <Wifi size={20} />
                              </div>
                              <div className="text-center relative z-10">
                                  <div className="text-sm font-bold text-indigo-900">Create Room</div>
                                  <div className="text-[10px] text-indigo-500 font-bold uppercase mt-1 bg-indigo-100 px-2 py-0.5 rounded-full">Role: Host (Black)</div>
                              </div>
                          </button>

                          {/* JOIN Section */}
                          <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl justify-between">
                              <div className="text-center">
                                  <div className="text-sm font-bold text-slate-700">Join Room</div>
                                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 inline-block bg-slate-100 px-2 py-0.5 rounded-full">Role: Guest (White)</div>
                              </div>
                              <div className="flex gap-2 mt-2">
                                  <input 
                                    type="text" 
                                    placeholder="Enter Code" 
                                    maxLength={4}
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-center font-mono font-bold text-lg focus:outline-none focus:border-indigo-500 bg-white"
                                  />
                                  <button 
                                    onClick={handleJoin} 
                                    disabled={joinCode.length !== 4} 
                                    className="px-3 bg-white border border-slate-200 hover:border-indigo-300 text-indigo-600 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center"
                                  >
                                      <ArrowRight size={20} />
                                  </button>
                              </div>
                          </div>
                      </div>
                  ) : (
                      // Connected / Waiting State
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col gap-3 relative">
                          <button onClick={() => engine.cleanupNetwork()} className="absolute top-2 right-2 p-1 text-indigo-300 hover:text-indigo-500 transition-colors">
                              <X size={16} />
                          </button>

                          {engine.networkStatus === 'connecting' && engine.roomId ? (
                              <div className="text-center">
                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Room Code</span>
                                <div className="text-5xl font-black text-indigo-600 font-mono tracking-widest my-2 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform" onClick={() => navigator.clipboard.writeText(engine.roomId!)}>
                                    {engine.roomId}
                                    <Copy size={16} className="text-indigo-300" />
                                </div>
                                <p className="text-xs text-indigo-400 animate-pulse">Waiting for opponent to join...</p>
                              </div>
                          ) : (
                              <div className="flex flex-col gap-2">
                                  <div className="text-sm font-bold text-indigo-600 flex items-center gap-2 justify-center">
                                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                      Connected!
                                  </div>
                                  
                                  {/* Role Display */}
                                  <div className="flex items-center justify-center gap-2 p-2 bg-white/50 rounded-lg border border-indigo-100/50">
                                      <span className="text-xs font-bold text-slate-500 uppercase">You are playing:</span>
                                      <div className={`flex items-center gap-1.5 text-sm font-black ${engine.myNetworkColor === Player.Black ? 'text-slate-800' : 'text-slate-500'}`}>
                                          <div className={`w-3 h-3 rounded-full ${engine.myNetworkColor === Player.Black ? 'bg-slate-800' : 'bg-white border border-slate-300'}`}></div>
                                          {engine.myNetworkColor === Player.Black ? 'Black (Host)' : 'White (Joiner)'}
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  )}
              </div>
          )}
      </div>

      {/* Game Status Message */}
      <div className="mb-4 min-h-[30px] flex justify-center w-full max-w-lg relative">
         {statusMessage}
      </div>

      {/* AI Reasoning (Only in AI Mode) */}
      {engine.isVsAI && engine.lastAIThought && !engine.isThinking && !showResultModal && (
         <div className="mb-6 max-w-xs text-center">
             <div className="relative inline-block bg-white border-2 border-indigo-100 px-4 py-2 rounded-2xl shadow-sm text-xs font-medium text-indigo-600 italic">
                "{engine.lastAIThought}"
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[2px] w-2 h-2 bg-white border-b-2 border-r-2 border-indigo-100 rotate-45"></div>
             </div>
         </div>
      )}

      {/* Board Area */}
      <div className="relative w-full max-w-[min(400px,90vw)] aspect-square mb-6">
         <GoBoard engine={engine} onPlaceStone={handlePlaceStone} tick={tick} />
         
         {/* Result Overlay */}
         {showResultModal && (
             <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 z-20">
                 <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 text-center animate-in fade-in zoom-in duration-300">
                     <Medal size={48} className={`mx-auto mb-3 ${ratingDiff && ratingDiff > 0 ? 'text-yellow-400' : 'text-slate-300'}`} />
                     <h3 className="text-2xl font-black text-slate-800 mb-1">
                         {ratingDiff && ratingDiff > 0 ? 'Victory!' : 'Game Over'}
                     </h3>
                     {engine.isVsAI && ratingDiff !== null && (
                         <div className="inline-block px-3 py-1 bg-slate-100 rounded-full text-sm font-bold text-slate-600 mb-4">
                             Rating: {ratingDiff > 0 ? '+' : ''}{ratingDiff}
                         </div>
                     )}
                     <div className="flex gap-2 justify-center">
                        <button onClick={handleReset} className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-colors">
                            Play Again
                        </button>
                     </div>
                 </div>
             </div>
         )}
      </div>

      {/* Action Buttons */}
      {!showResultModal && (
          <div className="flex gap-4">
            {(engine.isVsAI || engine.isNetworkGame) && (
                <>
                <button 
                    onClick={() => handleFinishGame('loss')}
                    className="flex items-center gap-2 text-slate-500 hover:text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors text-xs font-bold border border-transparent hover:border-red-100"
                >
                    <Flag size={14} />
                    Resign
                </button>
                {!engine.isNetworkGame && (
                    <button 
                        onClick={() => handleFinishGame('win')}
                        className="flex items-center gap-2 text-slate-500 hover:text-green-600 hover:bg-green-50 px-4 py-2 rounded-xl transition-colors text-xs font-bold border border-transparent hover:border-green-100"
                    >
                        <CheckCircle2 size={14} />
                        I Won
                    </button>
                )}
                </>
            )}
            <button 
                onClick={handleReset}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-600 px-4 py-2 rounded-lg transition-colors text-xs font-bold"
            >
                <RotateCcw size={14} />
                {engine.isNetworkGame ? 'Disconnect' : 'Reset'}
            </button>
          </div>
      )}

      {/* Captures */}
      <div className="mt-8 flex gap-6 opacity-60">
          <div className="flex items-center gap-2 text-xs font-bold">
              <div className="w-3 h-3 rounded-full bg-black"></div>
              {score.black} Stones
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
              <div className="w-3 h-3 rounded-full bg-white border border-slate-300"></div>
              {score.white} Stones
          </div>
      </div>

    </div>
  );
};

export default App;