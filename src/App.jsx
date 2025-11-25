import React, { useState, useEffect, useRef } from "react";
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
  arrayRemove,
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
  Bot,
  HelpCircle,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Trash2,
  Settings,
} from "lucide-react";

// --- Firebase Config ---
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

const GAME_APP_ID = "thief-police-v4-refined";

// --- Constants ---
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

// --- Helpers ---
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

// --- Sub-Components ---

const LeaveConfirmModal = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4">
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-sm w-full text-center shadow-2xl">
      <h3 className="text-xl font-bold text-white mb-2">Leave Game?</h3>
      <p className="text-slate-400 mb-6 text-sm">
        Are you sure you want to leave? You will be removed from the room.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onCancel}
          className="bg-slate-700 hover:bg-slate-600 text-white py-3 rounded font-bold"
        >
          No, Stay
        </button>
        <button
          onClick={onConfirm}
          className="bg-red-600 hover:bg-red-500 text-white py-3 rounded font-bold"
        >
          Yes, Leave
        </button>
      </div>
    </div>
  </div>
);

// --- Particle/Confetti Component ---
const Confetti = ({ type = "gold" }) => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const colors =
      type === "gold"
        ? ["#FFD700", "#FFA500", "#FFFF00", "#B8860B"]
        : ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF"];

    const count = 50;
    const newParticles = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100, // vw
        y: -10, // start above
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        duration: 1 + Math.random() * 2,
        left: Math.random() * 100,
      });
    }
    setParticles(newParticles);
  }, [type]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-full opacity-80 animate-fall"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            top: "-10px",
          }}
        />
      ))}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-fall {
          animation-name: fall;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
};

// --- Main Component ---
export default function ThiefPoliceGame() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("menu");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);

  // Lobby Rounds State
  const [lobbyRounds, setLobbyRounds] = useState(25);
  const [roundsError, setRoundsError] = useState("");

  // New State for confirmation modal
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Celebration States
  const [showConfetti, setShowConfetti] = useState(false);
  const [showKingEffect, setShowKingEffect] = useState(false);
  const [shakeScreen, setShakeScreen] = useState(false);

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

        // Sync local rounds state for host editing visual
        if (data.maxRounds && view === "lobby") {
          // We only update if we aren't currently editing (focus check difficult here)
          // Simpler: Just sync when view changes or initially.
          // For now, let's allow local state to drift only when user types.
        }

        // Ensure removed players are redirected
        const amIInRoom = data.players.some((p) => p.id === user.uid);
        if (!amIInRoom) {
          setRoomId(null);
          setView("menu");
          setError("You have left or were removed from the room.");
          return;
        }

        if (data.status === "playing" || data.status === "finished") {
          setView("game");
        } else {
          setView("lobby");
          setShowScoreboard(false);
        }
      } else {
        setRoomId(null);
        setView("menu");
        setError("Room closed.");
      }
    });
    return () => unsubscribe();
  }, [roomId, user, view]); // Added view to deps to help sync

  // --- Effects Logic ---
  useEffect(() => {
    if (!gameState || !user) return;

    const me = gameState.players.find((p) => p.id === user.uid);
    if (!me) return;

    const gameInstance = gameState.gameInstanceId || "default";
    const roundKey = `${gameState.id}-${gameInstance}-${gameState.currentRound}`;

    // 1. King Celebration (Personal)
    if (gameState.turnState === "GUESSING" && me.currentRole === "KING") {
      const key = `king-${roundKey}`;
      if (!sessionStorage.getItem(key)) {
        setShowKingEffect(true);
        setTimeout(() => setShowKingEffect(false), 3000);
        sessionStorage.setItem(key, "true");
      }
    }

    // 2. Result Celebrations (Role Based)
    if (gameState.turnState === "RESULT") {
      const key = `result-${roundKey}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "true");

        const lastHistory =
          gameState.roundHistory[gameState.roundHistory.length - 1];
        if (!lastHistory) return;

        const policeWon = lastHistory.winner === "Police";
        const amIPolice = me.currentRole === "POLICE";
        const amITarget = me.currentRole === lastHistory.target;

        if (policeWon) {
          if (amIPolice) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4000);
          } else if (amITarget) {
            setShakeScreen(true);
            setTimeout(() => setShakeScreen(false), 500);
          }
        } else {
          if (amIPolice) {
            setShakeScreen(true);
            setTimeout(() => setShakeScreen(false), 500);
          }
        }
      }
    }

    // 3. Auto Open Scoreboard on Finish
    if (gameState.status === "finished") {
      setShowScoreboard(true);
    }
  }, [gameState, user]);

  // --- Bot AI & Host Logic ---
  useEffect(() => {
    if (!gameState || !user || gameState.hostId !== user.uid) return;

    // 1. Bot Guessing Logic
    if (gameState.turnState === "GUESSING") {
      const policePlayer = gameState.players.find(
        (p) => p.currentRole === "POLICE"
      );
      if (policePlayer && policePlayer.isBot) {
        const timer = setTimeout(() => {
          const validTargets = gameState.players.filter(
            (p) => p.id !== policePlayer.id && p.currentRole !== "KING"
          );
          const randomTarget =
            validTargets[Math.floor(Math.random() * validTargets.length)];
          if (randomTarget) handlePoliceGuess(randomTarget.id);
        }, 2500);
        return () => clearTimeout(timer);
      }
    }

    // 2. Auto-Next Round Logic
    if (gameState.turnState === "RESULT") {
      const humanPlayers = gameState.players.filter((p) => !p.isBot);
      const readyCount = gameState.readyPlayers?.length || 0;

      if (readyCount >= humanPlayers.length && humanPlayers.length > 0) {
        setTimeout(() => executeNextRound(), 500);
      }
    }
  }, [gameState?.turnState, gameState?.readyPlayers?.length]);

  // --- Actions ---
  const createRoom = async () => {
    if (!user || !playerName.trim()) return setError("Enter nickname.");
    setLoading(true);
    const newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
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
      gameInstanceId: Date.now(),
      maxPlayers: 4,
      maxRounds: 25, // Default
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
      readyPlayers: [],
      gameReadyPlayers: [],
      turnState: "IDLE",
      roundTarget: null,
    };

    try {
      await setDoc(roomRef, roomData);
      setRoomId(newRoomId);
      setLobbyRounds(25);
    } catch (e) {
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
      if (data.players.length >= 4) throw new Error("Room full.");

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

  const leaveRoom = async () => {
    if (!roomId || !user) return;
    try {
      const roomRef = doc(
        db,
        "artifacts",
        GAME_APP_ID,
        "public",
        "data",
        "rooms",
        roomId
      );
      const docSnap = await getDoc(roomRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const updatedPlayers = data.players.filter((p) => p.id !== user.uid);
        await updateDoc(roomRef, { players: updatedPlayers });
      }
    } catch (e) {
      console.error(e);
    }
    setRoomId(null);
    setView("menu");
    setShowLeaveConfirm(false);
  };

  const kickPlayer = async (targetId) => {
    if (!roomId || !user) return;
    try {
      const roomRef = doc(
        db,
        "artifacts",
        GAME_APP_ID,
        "public",
        "data",
        "rooms",
        roomId
      );
      const docSnap = await getDoc(roomRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const updatedPlayers = data.players.filter((p) => p.id !== targetId);
        await updateDoc(roomRef, { players: updatedPlayers });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateRounds = async () => {
    if (!roomId || !user || gameState.hostId !== user.uid) return;
    const val = parseInt(lobbyRounds);
    if (val < 5 || val > 200 || isNaN(val)) {
      setRoundsError("Min 5, Max 200 rounds.");
      return;
    }
    setRoundsError("");
    await updateDoc(
      doc(db, "artifacts", GAME_APP_ID, "public", "data", "rooms", roomId),
      {
        maxRounds: val,
      }
    );
  };

  const toggleReady = async () => {
    const roomRef = doc(
      db,
      "artifacts",
      GAME_APP_ID,
      "public",
      "data",
      "rooms",
      roomId
    );
    if (!gameState.readyPlayers?.includes(user.uid)) {
      await updateDoc(roomRef, {
        readyPlayers: arrayUnion(user.uid),
      });
    }
  };

  const toggleGameReady = async () => {
    const roomRef = doc(
      db,
      "artifacts",
      GAME_APP_ID,
      "public",
      "data",
      "rooms",
      roomId
    );
    if (!gameState.gameReadyPlayers?.includes(user.uid)) {
      await updateDoc(roomRef, {
        gameReadyPlayers: arrayUnion(user.uid),
      });
    }
  };

  const executeNextRound = async () => {
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
        readyPlayers: [],
        lastRoundResult: null,
      }
    );
  };

  const handlePoliceGuess = async (targetPlayerId) => {
    const targetPlayer = gameState.players.find((p) => p.id === targetPlayerId);
    const requiredRole = gameState.roundTarget;

    let updatedPlayers = [...gameState.players];
    let resultMsg = "";
    let success = false;

    if (targetPlayer.currentRole === requiredRole) {
      success = true;
      resultMsg = `Success! Police caught the ${ROLES[requiredRole].name}.`;
      updatedPlayers = updatedPlayers.map((p) => {
        let score = 0;
        if (p.currentRole === "KING") score = 10;
        else if (p.currentRole === "POLICE") score = 8;
        else if (p.currentRole === requiredRole) score = 0;
        else score = ROLES[p.currentRole].points;
        return { ...p, roundScore: score, totalScore: p.totalScore + score };
      });
    } else {
      success = false;
      const actualRoleName = ROLES[targetPlayer.currentRole].name;
      resultMsg = `Failed! Police accused ${targetPlayer.name} (${actualRoleName}).`;
      updatedPlayers = updatedPlayers.map((p) => {
        let score = 0;
        if (p.currentRole === "KING") score = 10;
        else if (p.currentRole === "POLICE") score = 0;
        else score = ROLES[p.currentRole].points;
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
        gameInstanceId: Date.now(), // New ID for new session
        currentRound: 0,
        status: "lobby",
        players: resetPlayers,
        roundHistory: [],
        readyPlayers: [],
        gameReadyPlayers: [], // Reset Ready state
        turnState: "IDLE",
      }
    );
  };

  const addBot = async () => {
    const botId = `bot-${Date.now()}`;
    const usedNames = gameState.players.map((p) => p.name);
    const availableNames = BOT_NAMES.filter((n) => !usedNames.includes(n));
    const randomName =
      availableNames.length > 0
        ? availableNames[0]
        : `Bot ${gameState.players.length + 1}`;
    await updateDoc(
      doc(db, "artifacts", GAME_APP_ID, "public", "data", "rooms", roomId),
      {
        players: arrayUnion({
          id: botId,
          name: randomName,
          isBot: true,
          totalScore: 0,
          currentRole: null,
          roundScore: 0,
        }),
      }
    );
  };

  // --- Views ---

  if (view === "menu") {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
          <h1 className="text-4xl font-black text-center mb-2 bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
            THIEF POLICE
          </h1>
          <p className="text-center text-slate-400 text-sm mb-8">
            Babu Police Chor Daakat
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
              <button
                onClick={createRoom}
                disabled={loading}
                className="w-full mt-2 bg-yellow-600 hover:bg-yellow-500 py-2 rounded font-bold"
              >
                Create Lobby
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
                  className="bg-blue-600 hover:bg-blue-500 px-4 rounded font-bold"
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

  if (view === "lobby" && gameState) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center">
        {showLeaveConfirm && (
          <LeaveConfirmModal
            onConfirm={leaveRoom}
            onCancel={() => setShowLeaveConfirm(false)}
          />
        )}
        <div className="w-full max-w-lg">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold text-slate-200">
              Room:{" "}
              <span className="text-yellow-400 tracking-wider">
                {gameState.id}
              </span>
            </h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="bg-slate-800 p-2 rounded hover:bg-red-900/50 hover:text-red-400 transition-colors"
                title="Leave Room"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          {/* Round Settings Area */}
          <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400 font-bold">
                <Settings size={18} /> Rounds
              </div>
              {gameState.hostId === user.uid ? (
                <div className="flex flex-col items-end">
                  <input
                    type="number"
                    className="bg-slate-700 text-center w-20 p-2 rounded border border-slate-600 focus:border-yellow-500 outline-none font-bold"
                    value={lobbyRounds}
                    onChange={(e) => setLobbyRounds(e.target.value)}
                    onBlur={updateRounds}
                    min="5"
                    max="200"
                  />
                  {roundsError && (
                    <span className="text-red-400 text-[10px] mt-1">
                      {roundsError}
                    </span>
                  )}
                </div>
              ) : (
                <div className="font-black text-2xl text-yellow-500">
                  {gameState.maxRounds}
                </div>
              )}
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
                {gameState.hostId === user.uid && p.id !== user.uid && (
                  <button
                    onClick={() => kickPlayer(p.id)}
                    className="text-slate-500 hover:text-red-500 transition-colors p-1"
                    title="Kick Player"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {gameState.hostId === user.uid ? (
            <>
              {gameState.players.length < 4 && (
                <button
                  onClick={addBot}
                  className="w-full py-3 mb-4 rounded-xl border-2 border-dashed border-slate-600 text-slate-400 hover:bg-slate-800 flex items-center justify-center gap-2"
                >
                  <Bot size={18} /> Add AI Bot
                </button>
              )}
              <button
                onClick={executeNextRound}
                disabled={gameState.players.length !== 4 || !!roundsError}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
              >
                <Play size={20} /> Start Game
              </button>
            </>
          ) : (
            <div className="text-center text-slate-400 animate-pulse">
              Waiting for host...
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "game" && gameState) {
    const me = gameState.players.find((p) => p.id === user.uid);
    if (!me)
      return (
        <div className="text-white bg-slate-900 min-h-screen p-10 text-center">
          Loading...
        </div>
      );
    const currentPolice = gameState.players.find(
      (p) => p.currentRole === "POLICE"
    );
    const isPolice = me.currentRole === "POLICE";
    const iHaveVoted = gameState.readyPlayers?.includes(user.uid);
    const humanCount = gameState.players.filter((p) => !p.isBot).length;
    const voteCount = gameState.readyPlayers?.length || 0;

    // Game Ready (Play Again) Stats
    const iAmGameReady = gameState.gameReadyPlayers?.includes(user.uid);
    const gameReadyCount = gameState.gameReadyPlayers?.length || 0;
    // Human players excluding host (Host decides when to start, guests must signal ready)
    // Actually, simple logic: All humans minus host must be ready for host button to enable
    const otherHumanCount = humanCount - 1;

    return (
      <div
        className={`min-h-screen bg-slate-900 text-white flex flex-col relative overflow-hidden transition-transform duration-100 ${
          shakeScreen ? "translate-x-1" : ""
        }`}
      >
        {shakeScreen && (
          <div className="absolute inset-0 bg-red-500/20 z-40 pointer-events-none" />
        )}
        {showConfetti && <Confetti type="colorful" />}
        {showKingEffect && <Confetti type="gold" />}
        {showLeaveConfirm && (
          <LeaveConfirmModal
            onConfirm={leaveRoom}
            onCancel={() => setShowLeaveConfirm(false)}
          />
        )}

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
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="bg-slate-700 p-2 rounded hover:bg-red-900/50 hover:text-red-400 transition-colors"
              title="Leave Game"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 p-4 flex flex-col items-center justify-center gap-6">
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
                  Find the{" "}
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
                {gameState.status !== "finished" && (
                  <div className="mt-4">
                    <button
                      onClick={toggleReady}
                      disabled={iHaveVoted}
                      className={`w-full py-3 rounded-lg font-bold transition-all ${
                        iHaveVoted
                          ? "bg-slate-600 text-slate-400"
                          : "bg-green-600 hover:bg-green-500 text-white shadow-lg hover:scale-105"
                      }`}
                    >
                      {iHaveVoted
                        ? "Waiting for others..."
                        : "Ready for Next Round"}
                    </button>
                    <div className="text-xs text-center mt-2 text-slate-500">
                      {voteCount}/{humanCount} Players Ready
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Players Grid */}
          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            {gameState.players.map((p) => {
              let roleKey = p.currentRole;
              let isHidden = true;
              if (
                gameState.turnState === "RESULT" ||
                gameState.status === "finished"
              )
                isHidden = false;
              else if (
                roleKey === "KING" ||
                roleKey === "POLICE" ||
                p.id === user.uid
              )
                isHidden = false;

              const roleInfo = roleKey ? ROLES[roleKey] : null;
              const canSelect =
                isPolice && gameState.turnState === "GUESSING" && isHidden;
              const isMe = p.id === user.uid;

              return (
                <div
                  key={p.id}
                  onClick={() => (canSelect ? handlePoliceGuess(p.id) : null)}
                  className={`
                                relative p-4 rounded-xl border-2 flex flex-col items-center justify-center aspect-[3/4] transition-all
                                ${
                                  isMe
                                    ? "bg-slate-800 shadow-[0_0_20px_rgba(6,182,212,0.4)] border-cyan-400 ring-2 ring-cyan-400/30 transform scale-105 z-10"
                                    : "bg-slate-800 border-slate-700"
                                }
                                ${
                                  canSelect
                                    ? "cursor-pointer hover:scale-105 border-blue-400 bg-blue-900/20 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                    : ""
                                }
                            `}
                >
                  <div
                    className={`font-bold text-sm mb-2 truncate w-full text-center flex items-center justify-center gap-1 ${
                      isMe ? "text-cyan-300" : "text-white"
                    }`}
                  >
                    {p.isBot && <Bot size={12} className="text-purple-400" />}
                    {p.name} {isMe && "(You)"}
                  </div>

                  {isHidden ? (
                    <div className="flex-1 flex items-center justify-center">
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

                  {gameState.turnState === "RESULT" && (
                    <div
                      className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 border-slate-900 shadow-lg ${
                        p.roundScore > 0 ? "bg-green-500" : "bg-red-500"
                      }`}
                    >
                      {p.roundScore}
                    </div>
                  )}

                  {/* Vote Indicator */}
                  {gameState.turnState === "RESULT" &&
                    gameState.readyPlayers?.includes(p.id) && (
                      <div className="absolute bottom-2 right-2 text-green-500 bg-slate-900 rounded-full">
                        <CheckCircle size={16} />
                      </div>
                    )}
                </div>
              );
            })}
          </div>

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
            <div className="bg-slate-800 w-full max-w-2xl max-h-[85vh] rounded-2xl flex flex-col border border-slate-700 shadow-2xl relative">
              <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Trophy className="text-yellow-400" /> Scoreboard
                </h3>
                {gameState.status !== "finished" && (
                  <button onClick={() => setShowScoreboard(false)}>
                    <X />
                  </button>
                )}
              </div>

              {/* Calculate Winners */}
              {(() => {
                const sortedPlayers = [...gameState.players].sort(
                  (a, b) => b.totalScore - a.totalScore
                );
                const topScore = sortedPlayers[0]?.totalScore || 0;
                const winners = sortedPlayers.filter(
                  (p) => p.totalScore === topScore
                );
                const isTie = winners.length > 1;

                return (
                  <>
                    {/* Winner Banner */}
                    {gameState.status === "finished" && (
                      <div className="bg-gradient-to-r from-yellow-600 to-yellow-800 p-4 text-center">
                        <div className="text-sm font-bold text-yellow-200 uppercase tracking-widest">
                          {isTie ? "Champions" : "Champion"}
                        </div>
                        <div className="text-3xl font-black text-white drop-shadow-md">
                          {winners.map((w) => w.name).join(" & ")}
                        </div>
                      </div>
                    )}

                    <div className="p-4 bg-slate-900/50">
                      <div className="grid grid-cols-4 gap-2 text-xs font-bold text-slate-500 uppercase mb-2 text-center">
                        <div className="text-left pl-2">Player</div>
                        <div>Role</div>
                        <div>Last</div>
                        <div>Total</div>
                      </div>
                      {sortedPlayers.map((p, i) => {
                        const isWinner =
                          gameState.status === "finished" &&
                          p.totalScore === topScore;
                        return (
                          <div
                            key={p.id}
                            className={`grid grid-cols-4 gap-2 p-3 rounded mb-1 items-center text-center ${
                              isWinner
                                ? "bg-yellow-900/30 border border-yellow-500/50"
                                : "bg-slate-700"
                            }`}
                          >
                            <div className="text-left font-bold truncate flex items-center gap-1">
                              {isWinner && (
                                <Crown size={12} className="text-yellow-400" />
                              )}{" "}
                              {p.name}
                            </div>
                            <div className="text-xs opacity-70">
                              {p.currentRole ? ROLES[p.currentRole].name : "-"}
                            </div>
                            <div
                              className={`font-bold ${
                                p.roundScore > 0
                                  ? "text-green-400"
                                  : "text-slate-500"
                              }`}
                            >
                              +{p.roundScore}
                            </div>
                            <div className="font-black text-yellow-400 text-lg">
                              {p.totalScore}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              <div className="flex-1 overflow-y-auto p-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
                  History
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
                    {/* RESTORED DETAILED BREAKDOWN */}
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

              {/* Restart Area */}
              {gameState.status === "finished" && (
                <div className="p-4 border-t border-slate-700 bg-slate-800 rounded-b-2xl">
                  {gameState.hostId === user.uid ? (
                    <>
                      <button
                        onClick={restartGame}
                        disabled={gameReadyCount < otherHumanCount}
                        className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:text-slate-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-lg shadow-lg"
                      >
                        {gameReadyCount < otherHumanCount ? (
                          <>
                            <RotateCcw className="animate-spin" /> Waiting for
                            Players ({gameReadyCount}/{otherHumanCount})
                          </>
                        ) : (
                          <>
                            <RotateCcw /> Play Again
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={toggleGameReady}
                      disabled={iAmGameReady}
                      className={`w-full py-3 rounded-xl font-bold transition-colors ${
                        iAmGameReady
                          ? "bg-slate-600 text-slate-400"
                          : "bg-blue-600 hover:bg-blue-500"
                      }`}
                    >
                      {iAmGameReady
                        ? "Waiting for Host..."
                        : "Ready for Next Game"}
                    </button>
                  )}
                </div>
              )}
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
