import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
} from "firebase/firestore";
import {
  Crown,
  Shield,
  Skull,
  Footprints,
  User,
  Trophy,
  History,
  Play,
  LogOut,
  X,
  Bot, // Icon for Bots
  HelpCircle,
  AlertTriangle,
} from "lucide-react";

// --- Firebase Config ---
// Using the config from your provided file
const firebaseConfig = {
  apiKey: "AIzaSyDf86JHBvY9Y1B1x8QDbJkASmlANouEvX0",
  authDomain: "card-games-28729.firebaseapp.com",
  projectId: "card-games-28729",
  storageBucket: "card-games-28729.firebasestorage.app",
  messagingSenderId: "466779458834",
  appId: "1:466779458834:web:e55fbec522369cc56d37cb",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Unique App ID for this game
const GAME_APP_ID = "thief-police-v2-bots";

// --- Game Constants ---
const ROLES = {
  KING: {
    name: "King",
    points: 10,
    icon: Crown,
    color: "bg-yellow-600",
    textColor: "text-yellow-400",
  },
  POLICE: {
    name: "Police",
    points: 8,
    icon: Shield,
    color: "bg-blue-600",
    textColor: "text-blue-400",
  },
  ROBBER: {
    name: "Robber",
    points: 6,
    icon: Skull,
    color: "bg-red-600",
    textColor: "text-red-400",
  },
  THIEF: {
    name: "Thief",
    points: 4,
    icon: Footprints,
    color: "bg-gray-600",
    textColor: "text-gray-400",
  },
};

const ROUND_OPTIONS = [25, 50, 75, 100];
const BOT_NAMES = [
  "Terminator",
  "RoboCop",
  "Wall-E",
  "R2-D2",
  "Jarvis",
  "Ultron",
  "Hal-9000",
  "GLaDOS",
];

// --- Helper Functions ---
const shuffle = (array) => {
  let currentIndex = array.length,
    randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
};

// --- Main Component ---
export default function ThiefPoliceGame() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("menu"); // menu, lobby, game
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRounds, setSelectedRounds] = useState(25);
  const [showScoreboard, setShowScoreboard] = useState(false);

  // --- Auth & Sync ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!roomId || !user) return;
    const roomRef = doc(
      db,
      "artifacts",
      GAME_APP_ID,
      "public",
      "data",
      "rooms",
      roomId
    );

    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameState({ id: docSnap.id, ...data });
        if (data.status === "playing" || data.status === "finished")
          setView("game");
        else setView("lobby");
      } else {
        setRoomId(null);
        setView("menu");
        setError("Room closed or does not exist.");
      }
    });
    return () => unsubscribe();
  }, [roomId, user]);

  // --- Bot AI Logic (Host Brain) ---
  useEffect(() => {
    // 1. Only Host runs logic
    if (!gameState || !user || gameState.hostId !== user.uid) return;

    // 2. Only run during guessing phase
    if (gameState.turnState !== "GUESSING") return;

    // 3. Find Police
    const policePlayer = gameState.players.find(
      (p) => p.currentRole === "POLICE"
    );

    // 4. If Police is a BOT
    if (policePlayer && policePlayer.isBot) {
      const timer = setTimeout(() => {
        // AI Strategy: Guess anyone who isn't self and isn't King
        const validTargets = gameState.players.filter(
          (p) => p.id !== policePlayer.id && p.currentRole !== "KING"
        );

        // Random Pick
        const randomTarget =
          validTargets[Math.floor(Math.random() * validTargets.length)];

        if (randomTarget) {
          handlePoliceGuess(randomTarget.id);
        }
      }, 2500); // 2.5s delay for realism

      return () => clearTimeout(timer);
    }
  }, [gameState?.turnState, gameState?.currentRound]);

  // --- Room Actions ---
  const createRoom = async () => {
    if (!user || !playerName.trim()) return setError("Enter nickname.");
    setLoading(true);
    const newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();

    // Ensure unique ID for public data path
    const roomRef = doc(
      db,
      "artifacts",
      GAME_APP_ID,
      "public",
      "data",
      "rooms",
      newRoomId
    );

    const roomData = {
      hostId: user.uid,
      maxPlayers: 4,
      maxRounds: parseInt(selectedRounds),
      currentRound: 0,
      status: "lobby",
      players: [
        {
          id: user.uid,
          name: playerName,
          isBot: false,
          totalScore: 0,
          currentRole: null,
          roundScore: 0,
        },
      ],
      roundHistory: [],
      turnState: "IDLE",
      roundTarget: null,
    };

    try {
      await setDoc(roomRef, roomData);
      setRoomId(newRoomId);
    } catch (e) {
      console.error(e);
      setError("Failed to create room.");
    }
    setLoading(false);
  };

  const joinRoom = async () => {
    if (!user || !roomCode || !playerName.trim())
      return setError("Enter details.");
    setLoading(true);
    const roomRef = doc(
      db,
      "artifacts",
      GAME_APP_ID,
      "public",
      "data",
      "rooms",
      roomCode
    );

    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) throw new Error("Room not found.");
      const data = snap.data();
      if (data.players.length >= 4) throw new Error("Room full (Max 4).");
      if (data.status !== "lobby") throw new Error("Game in progress.");

      const exists = data.players.find((p) => p.id === user.uid);
      if (!exists) {
        await updateDoc(roomRef, {
          players: arrayUnion({
            id: user.uid,
            name: playerName,
            isBot: false,
            totalScore: 0,
            currentRole: null,
            roundScore: 0,
          }),
        });
      }
      setRoomId(roomCode);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const addBot = async () => {
    if (!gameState || gameState.hostId !== user.uid) return;
    if (gameState.players.length >= 4) return;

    const botId = `bot-${Date.now()}`;
    // Get a random unique name
    const usedNames = gameState.players.map((p) => p.name);
    const availableNames = BOT_NAMES.filter((n) => !usedNames.includes(n));
    const randomName =
      availableNames.length > 0
        ? availableNames[0]
        : `Bot ${gameState.players.length + 1}`;

    const newBot = {
      id: botId,
      name: randomName,
      isBot: true,
      totalScore: 0,
      currentRole: null,
      roundScore: 0,
    };

    await updateDoc(
      doc(db, "artifacts", GAME_APP_ID, "public", "data", "rooms", roomId),
      {
        players: arrayUnion(newBot),
      }
    );
  };

  const removeBot = async (botId) => {
    const updatedPlayers = gameState.players.filter((p) => p.id !== botId);
    await updateDoc(
      doc(db, "artifacts", GAME_APP_ID, "public", "data", "rooms", roomId),
      {
        players: updatedPlayers,
      }
    );
  };

  // --- Game Logic ---
  const startNextRound = async () => {
    if (!gameState || gameState.hostId !== user.uid) return;
    if (gameState.players.length !== 4) return alert("Need exactly 4 players!");

    if (gameState.currentRound >= gameState.maxRounds) {
      await updateDoc(
        doc(db, "artifacts", GAME_APP_ID, "public", "data", "rooms", roomId),
        {
          status: "finished",
        }
      );
      return;
    }

    const deck = shuffle(["KING", "POLICE", "ROBBER", "THIEF"]);
    const nextRoundNum = gameState.currentRound + 1;
    // Odd Rounds (1,3,5): Find Thief | Even Rounds (2,4,6): Find Robber
    const target = nextRoundNum % 2 !== 0 ? "THIEF" : "ROBBER";

    const updatedPlayers = gameState.players.map((p, i) => ({
      ...p,
      currentRole: deck[i],
      roundScore: 0,
    }));

    await updateDoc(
      doc(db, "artifacts", GAME_APP_ID, "public", "data", "rooms", roomId),
      {
        status: "playing",
        currentRound: nextRoundNum,
        turnState: "GUESSING",
        roundTarget: target,
        players: updatedPlayers,
        lastRoundResult: null,
      }
    );
  };

  const handlePoliceGuess = async (targetPlayerId) => {
    // Only police or host-bot-logic can trigger this
    // We double check legitimacy in logic, but client side check is:
    // if human: must be police
    // if bot: host triggers it

    const targetPlayer = gameState.players.find((p) => p.id === targetPlayerId);
    const requiredRole = gameState.roundTarget; // THIEF or ROBBER

    let updatedPlayers = [...gameState.players];
    let resultMsg = "";
    let success = false;

    // --- Scoring Logic ---
    if (targetPlayer.currentRole === requiredRole) {
      success = true;
      resultMsg = `Success! Police caught the ${ROLES[requiredRole].name}.`;

      updatedPlayers = updatedPlayers.map((p) => {
        let score = 0;
        if (p.currentRole === "KING") score = 10;
        else if (p.currentRole === "POLICE") score = 8;
        else if (p.currentRole === requiredRole) score = 0; // Caught target
        else score = ROLES[p.currentRole].points; // Innocent bystander

        return { ...p, roundScore: score, totalScore: p.totalScore + score };
      });
    } else {
      success = false;
      const actualRoleName = ROLES[targetPlayer.currentRole].name;
      resultMsg = `Failed! Police accused ${targetPlayer.name} (${actualRoleName}).`;

      updatedPlayers = updatedPlayers.map((p) => {
        let score = 0;
        if (p.currentRole === "KING") score = 10;
        else if (p.currentRole === "POLICE") score = 0; // Police Failed
        else score = ROLES[p.currentRole].points; // Everyone else keeps points

        return { ...p, roundScore: score, totalScore: p.totalScore + score };
      });
    }

    const historyEntry = {
      round: gameState.currentRound,
      target: gameState.roundTarget,
      winner: success ? "Police" : "Criminals",
      scores: updatedPlayers.map((p) => ({
        name: p.name,
        role: p.currentRole,
        score: p.roundScore,
      })),
    };

    await updateDoc(
      doc(db, "artifacts", GAME_APP_ID, "public", "data", "rooms", roomId),
      {
        players: updatedPlayers,
        turnState: "RESULT",
        lastRoundResult: resultMsg,
        roundHistory: arrayUnion(historyEntry),
      }
    );
  };

  const restartGame = async () => {
    const resetPlayers = gameState.players.map((p) => ({
      ...p,
      totalScore: 0,
      currentRole: null,
      roundScore: 0,
    }));
    await updateDoc(
      doc(db, "artifacts", GAME_APP_ID, "public", "data", "rooms", roomId),
      {
        currentRound: 0,
        status: "lobby",
        players: resetPlayers,
        roundHistory: [],
        turnState: "IDLE",
      }
    );
  };

  // --- Views ---

  // 1. Menu
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
          <h1 className="text-4xl font-black text-center mb-2 bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
            THIEF POLICE
          </h1>
          <p className="text-center text-slate-400 text-sm mb-8">
            Babu Chor Dakat Police
          </p>

          {error && (
            <div className="bg-red-500/20 text-red-200 p-3 rounded mb-4 text-sm text-center">
              {error}
            </div>
          )}

          <input
            className="w-full bg-slate-700 p-3 rounded mb-4 border border-slate-600 focus:border-yellow-500 outline-none"
            placeholder="Your Nickname"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />

          <div className="space-y-4">
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
              <h3 className="text-sm font-bold text-slate-300 mb-2">
                Create Room
              </h3>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-slate-400">Total Rounds:</span>
                <div className="flex gap-2">
                  {ROUND_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSelectedRounds(opt)}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        selectedRounds === opt
                          ? "bg-yellow-600 text-white"
                          : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={createRoom}
                disabled={loading}
                className="w-full bg-yellow-600 hover:bg-yellow-500 py-2 rounded font-bold transition-colors"
              >
                Create
              </button>
            </div>

            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
              <h3 className="text-sm font-bold text-slate-300 mb-2">
                Join Room
              </h3>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-slate-700 p-2 rounded text-sm uppercase"
                  placeholder="CODE"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                />
                <button
                  onClick={joinRoom}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-500 px-4 rounded font-bold transition-colors"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Lobby
  if (view === "lobby" && gameState) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center">
        <div className="w-full max-w-lg">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold text-slate-200">
              Room:{" "}
              <span className="text-yellow-400 tracking-wider">
                {gameState.id}
              </span>
            </h2>
            <div className="text-right">
              <div className="text-xs text-slate-400">Rounds</div>
              <div className="font-bold text-xl">{gameState.maxRounds}</div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
            <div className="flex justify-between mb-4 text-xs font-bold text-slate-500 uppercase">
              <span>Players</span>
              <span>{gameState.players.length} / 4</span>
            </div>
            {gameState.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-slate-700 p-3 rounded mb-2"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      p.isBot ? "bg-purple-600" : "bg-slate-600"
                    }`}
                  >
                    {p.isBot ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <span
                    className={
                      p.id === user.uid
                        ? "text-yellow-400 font-bold"
                        : "text-white"
                    }
                  >
                    {p.name} {p.id === gameState.hostId && "👑"}
                  </span>
                </div>
                {p.isBot && gameState.hostId === user.uid && (
                  <button
                    onClick={() => removeBot(p.id)}
                    className="text-red-400 hover:text-red-300 text-[10px] font-bold border border-red-500/50 px-2 py-1 rounded"
                  >
                    REMOVE
                  </button>
                )}
              </div>
            ))}
            {gameState.players.length < 4 && (
              <div className="text-center text-slate-500 text-sm mt-4 italic">
                Waiting for players...
              </div>
            )}
          </div>

          {gameState.hostId === user.uid && (
            <>
              {gameState.players.length < 4 && (
                <button
                  onClick={addBot}
                  className="w-full py-3 mb-4 rounded-xl border-2 border-dashed border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Bot size={18} /> Add AI Bot
                </button>
              )}

              <button
                onClick={startNextRound}
                disabled={gameState.players.length !== 4}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Play size={20} /> Start Game
              </button>
            </>
          )}
          {gameState.hostId !== user.uid && (
            <div className="text-center text-slate-400 animate-pulse mt-4">
              Waiting for host to start...
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Game & Scoreboard
  if (view === "game" && gameState) {
    const me = gameState.players.find((p) => p.id === user.uid);
    if (!me)
      return (
        <div className="text-white bg-slate-900 min-h-screen p-10 text-center">
          Removed from game.
        </div>
      );

    const currentPolice = gameState.players.find(
      (p) => p.currentRole === "POLICE"
    );
    const isPolice = me.currentRole === "POLICE";

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="bg-slate-800 p-3 flex justify-between items-center shadow-lg z-10">
          <div>
            <div className="text-xs text-slate-400">Round</div>
            <div className="font-bold text-xl leading-none">
              {gameState.currentRound}{" "}
              <span className="text-slate-500 text-sm">
                / {gameState.maxRounds}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowScoreboard(true)}
              className="bg-slate-700 p-2 rounded hover:bg-slate-600"
            >
              <History size={20} />
            </button>
          </div>
        </div>

        {/* Main Game Area */}
        <div className="flex-1 p-4 flex flex-col items-center justify-center gap-6">
          {/* Instruction Banner */}
          <div className="text-center mb-4 w-full max-w-md">
            {gameState.status === "finished" ? (
              <div className="text-3xl font-bold text-yellow-400 animate-bounce">
                GAME OVER
              </div>
            ) : gameState.turnState === "GUESSING" ? (
              <>
                <div className="text-slate-400 text-sm uppercase tracking-widest mb-1">
                  Mission
                </div>
                <div className="text-2xl font-bold mb-2">
                  Police must find the{" "}
                  <span
                    className={
                      gameState.roundTarget === "THIEF"
                        ? "text-slate-300"
                        : "text-red-500"
                    }
                  >
                    {gameState.roundTarget}
                  </span>
                </div>
                <div className="text-sm bg-slate-800/50 p-2 rounded-lg border border-slate-700 animate-pulse text-blue-300">
                  {isPolice
                    ? "Click a player to guess!"
                    : `${currentPolice?.name} is investigating...`}
                </div>
              </>
            ) : (
              <div className="bg-slate-800 px-6 py-4 rounded-xl border border-slate-600 shadow-xl w-full">
                <div className="text-lg font-bold mb-1">
                  {gameState.lastRoundResult}
                </div>
                {gameState.hostId === user.uid &&
                  gameState.status !== "finished" && (
                    <button
                      onClick={startNextRound}
                      className="mt-4 w-full bg-green-600 py-3 rounded-lg font-bold hover:bg-green-500 transition-colors"
                    >
                      Next Round
                    </button>
                  )}
                {gameState.hostId !== user.uid &&
                  gameState.status !== "finished" && (
                    <div className="text-xs text-slate-500 mt-2">
                      Waiting for host...
                    </div>
                  )}
                {gameState.status === "finished" &&
                  gameState.hostId === user.uid && (
                    <button
                      onClick={restartGame}
                      className="mt-4 w-full bg-yellow-600 py-3 rounded-lg font-bold hover:bg-yellow-500"
                    >
                      New Game
                    </button>
                  )}
              </div>
            )}
          </div>

          {/* Players Grid */}
          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            {gameState.players.map((p) => {
              // Visibility Logic
              let roleKey = p.currentRole;
              let isHidden = false;

              // If round is over, reveal all
              if (
                gameState.turnState === "RESULT" ||
                gameState.status === "finished"
              ) {
                isHidden = false;
              }
              // During guessing:
              else {
                // King and Police always visible
                if (roleKey === "KING" || roleKey === "POLICE")
                  isHidden = false;
                // My own card always visible to me (Human only)
                else if (p.id === user.uid) isHidden = false;
                // Otherwise (Robber/Thief looking at each other, or Police looking at them) -> Hidden
                else isHidden = true;
              }

              const roleInfo = roleKey ? ROLES[roleKey] : null;
              const canSelect =
                isPolice && gameState.turnState === "GUESSING" && isHidden;

              return (
                <div
                  key={p.id}
                  onClick={() => (canSelect ? handlePoliceGuess(p.id) : null)}
                  className={`
                                relative p-4 rounded-xl border-2 flex flex-col items-center justify-center aspect-[3/4] transition-all
                                ${
                                  canSelect
                                    ? "cursor-pointer hover:scale-105 border-blue-400 bg-blue-900/20 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                    : "border-slate-700 bg-slate-800"
                                }
                                ${
                                  gameState.turnState === "RESULT" &&
                                  p.id === user.uid
                                    ? "ring-2 ring-white"
                                    : ""
                                }
                            `}
                >
                  <div className="font-bold text-sm mb-2 text-white truncate w-full text-center flex items-center justify-center gap-1">
                    {p.isBot && <Bot size={12} className="text-purple-400" />}
                    {p.name} {p.id === user.uid && "(You)"}
                  </div>

                  {isHidden ? (
                    <div className="flex-1 flex items-center justify-center animate-in fade-in zoom-in">
                      <HelpCircle size={48} className="text-slate-600" />
                      <div className="absolute bottom-4 text-xs font-bold text-slate-500">
                        UNKNOWN
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                      <roleInfo.icon size={48} className={roleInfo.textColor} />
                      <div
                        className={`mt-2 font-black uppercase ${roleInfo.textColor}`}
                      >
                        {roleInfo.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {roleInfo.points} pts
                      </div>
                    </div>
                  )}

                  {/* Score Delta Badge during Result */}
                  {gameState.turnState === "RESULT" && (
                    <div
                      className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 border-slate-900 shadow-lg ${
                        p.roundScore > 0 ? "bg-green-500" : "bg-red-500"
                      }`}
                    >
                      {p.roundScore}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* My Total Score Footer */}
          <div className="mt-auto bg-slate-800 w-full max-w-md p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-lg">
            <span className="text-slate-400 text-sm font-bold">MY SCORE</span>
            <span className="text-3xl font-black text-yellow-500">
              {me.totalScore}
            </span>
          </div>
        </div>

        {/* Scoreboard Modal */}
        {showScoreboard && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-2xl max-h-[80vh] rounded-2xl flex flex-col border border-slate-700 shadow-2xl">
              <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Trophy className="text-yellow-400" /> Scoreboard
                </h3>
                <button onClick={() => setShowScoreboard(false)}>
                  <X />
                </button>
              </div>

              {/* Leaderboard */}
              <div className="p-4 bg-slate-900/50">
                <div className="grid grid-cols-4 gap-2 text-xs font-bold text-slate-500 uppercase mb-2 text-center">
                  <div className="text-left pl-2">Player</div>
                  <div>Role</div>
                  <div>Last</div>
                  <div>Total</div>
                </div>
                {gameState.players
                  .sort((a, b) => b.totalScore - a.totalScore)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="grid grid-cols-4 gap-2 bg-slate-700 p-3 rounded mb-1 items-center text-center"
                    >
                      <div className="text-left font-bold truncate flex items-center gap-1">
                        {p.isBot && (
                          <Bot size={10} className="text-purple-400" />
                        )}{" "}
                        {p.name}
                      </div>
                      <div className="text-xs opacity-70">
                        {p.currentRole ? ROLES[p.currentRole].name : "-"}
                      </div>
                      <div
                        className={`font-bold ${
                          p.roundScore > 0 ? "text-green-400" : "text-slate-500"
                        }`}
                      >
                        +{p.roundScore}
                      </div>
                      <div className="font-black text-yellow-400 text-lg">
                        {p.totalScore}
                      </div>
                    </div>
                  ))}
              </div>

              {/* History */}
              <div className="flex-1 overflow-y-auto p-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
                  Round History
                </h4>
                {[...(gameState.roundHistory || [])].reverse().map((h, i) => (
                  <div
                    key={i}
                    className="mb-2 text-sm border-b border-slate-700 pb-2"
                  >
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>
                        Round {h.round} • Hunted {h.target}
                      </span>
                      <span
                        className={
                          h.winner === "Police"
                            ? "text-blue-400"
                            : "text-red-400"
                        }
                      >
                        {h.winner} Won
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {h.scores.map((s, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-800 p-1 rounded text-center"
                        >
                          <div className="text-[10px] text-slate-500 truncate">
                            {s.name}
                          </div>
                          <div
                            className={`font-bold text-xs ${
                              s.score > 0 ? "text-green-400" : "text-slate-600"
                            }`}
                          >
                            +{s.score}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="text-white text-center p-10">Loading Game Resources...</div>
  );
}
