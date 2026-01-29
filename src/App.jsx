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
  deleteDoc,
  onSnapshot,
  arrayUnion,
} from "firebase/firestore";
import {
  Crown,
  Shield,
  Siren,
  Skull,
  Footprints,
  User,
  Trophy,
  Play,
  LogOut,
  X,
  Bot,
  HelpCircle,
  CheckCircle,
  RotateCcw,
  Trash2,
  Settings,
  BookOpen,
  Home,
  Hammer,
  Sparkles,
  Copy,
} from "lucide-react";

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const GAME_APP_ID =
  typeof __app_id !== "undefined" ? __app_id : "police-hunt-game";
const GAME_ID = "3";

// --- Constants ---
const ROLES = {
  KING: {
    name: "King",
    points: 10,
    icon: Crown,
    color: "bg-yellow-600",
    textColor: "text-yellow-400",
    desc: "The ruler. Always scores high (10 pts).",
  },
  POLICE: {
    name: "Police",
    points: 8,
    icon: Shield,
    color: "bg-blue-600",
    textColor: "text-blue-400",
    desc: "The enforcer. Must find the criminal to score (8 pts).",
  },
  ROBBER: {
    name: "Robber",
    points: 6,
    icon: Skull,
    color: "bg-red-600",
    textColor: "text-red-500",
    desc: "The heavy criminal. Scores 6 pts if not caught.",
  },
  THIEF: {
    name: "Thief",
    points: 4,
    icon: Footprints,
    color: "bg-red-600",
    textColor: "text-red-300",
    desc: "The petty criminal. Scores 4 pts if not caught.",
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

const FloatingBackground = ({ isShaking }) => (
  <div
    className={`absolute inset-0 overflow-hidden pointer-events-none z-0 ${
      isShaking ? "animate-shake bg-red-900/20" : ""
    }`}
  >
    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-yellow-900/20 via-gray-950 to-black" />
    <div className="absolute top-0 left-0 w-full h-full opacity-10">
      {[...Array(20)].map((_, i) => {
        const fruitKeys = Object.keys(ROLES);
        const Icon = ROLES[fruitKeys[i % fruitKeys.length]].icon;
        return (
          <div
            key={i}
            className="absolute animate-float text-white/60"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDuration: `${10 + Math.random() * 20}s`,
              transform: `scale(${0.5 + Math.random()})`,
            }}
          >
            <Icon size={32} />
          </div>
        );
      })}
    </div>
    <style>{`
      @keyframes float {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50% { transform: translateY(-20px) rotate(10deg); }
      }
      .animate-float { animation: float infinite ease-in-out; }
      
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }
      .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
    `}</style>
  </div>
);

const PoliceLogo = () => (
  <div className="flex items-center justify-center gap-1 opacity-40 mt-auto pb-2 pt-2 relative z-10">
    <Siren size={12} className="text-red-500" />
    <span className="text-[10px] font-black tracking-widest text-blue-500 uppercase">
      POLICE HUNT
    </span>
  </div>
);

const PoliceLogoBig = () => (
  <div className="flex items-center justify-center gap-1 opacity-40 mt-auto pb-2 pt-2 relative z-10">
    <Siren size={22} className="text-red-500" />
    <span className="text-[20px] font-black tracking-widest text-blue-500 uppercase">
      POLICE HUNT
    </span>
  </div>
);

const LeaveConfirmModal = ({
  onConfirmLeave,
  onConfirmLobby,
  onCancel,
  isHost,
  inGame,
}) => (
  <div className="fixed inset-0 bg-black/90 z-200 flex items-center justify-center p-4 animate-in fade-in">
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-sm w-full text-center shadow-2xl">
      <h3 className="text-xl font-bold text-white mb-2">Depart Station?</h3>
      <p className="text-slate-400 mb-6 text-sm">
        {inGame
          ? "Leaving now will end the hunt for everyone!"
          : "Leaving the lobby will disconnect you."}
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={onCancel}
          className="bg-slate-700 hover:bg-slate-600 text-white py-3 rounded font-bold transition-colors"
        >
          Stay (Cancel)
        </button>

        {/* Lobby Button - Only visible in GAME view and only for HOST */}
        {inGame && isHost && (
          <button
            onClick={onConfirmLobby}
            className="py-3 rounded font-bold transition-colors flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white"
          >
            <Home size={18} /> Return Squad to Lobby
          </button>
        )}

        <button
          onClick={onConfirmLeave}
          className="bg-red-600 hover:bg-red-500 text-white py-3 rounded font-bold transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={18} /> Leave Game
        </button>
      </div>
    </div>
  </div>
);

const GameGuideModal = ({ onClose }) => (
  <div className="fixed inset-0 bg-black/95 z-100 flex items-center justify-center p-0 md:p-4 backdrop-blur-md animate-in fade-in">
    <div className="bg-slate-800 md:rounded-2xl w-full max-w-4xl h-full md:h-auto max-h-[90vh] overflow-hidden border-none md:border border-slate-600 shadow-2xl flex flex-col relative">
      <div className="p-4 md:p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
        <div className="flex flex-col">
          <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-linear-to-r from-red-700 to-blue-600 uppercase tracking-widest">
            Game Rules
          </h2>
          <span className="text-slate-400 text-xs md:text-sm font-bold tracking-wide">
            Deduction & Deception
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 text-slate-300">
        <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600">
          <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Trophy className="text-yellow-500" size={24} /> The Objective
          </h3>
          <p className="text-slate-300 leading-relaxed">
            The goal is to accumulate the highest score after a set number of
            rounds. Roles are shuffled every round.
            <br />
            <br />
            <strong>The Twist:</strong> The{" "}
            <span className="text-blue-400 font-bold">Police</span> must find
            the correct criminal. If they succeed, they score points. If they
            fail, the criminal escapes with the loot!
          </p>
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <User className="text-purple-400" size={24} /> The Roles
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(ROLES).map((role) => (
              <div
                key={role.name}
                className="flex items-start gap-4 bg-slate-700/30 p-4 rounded-xl border border-slate-600"
              >
                <div
                  className={`p-3 rounded-xl bg-slate-800 border border-slate-700 shadow-lg`}
                >
                  <role.icon className={role.textColor} size={28} />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h4 className={`font-black text-lg ${role.textColor}`}>
                      {role.name}
                    </h4>
                    <span className="bg-slate-900 px-2 py-0.5 rounded text-xs font-bold text-slate-400">
                      {role.points} Pts
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-tight">
                    {role.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Siren className="text-blue-400" size={24} /> How It Works
          </h3>
          <div className="space-y-4 text-sm md:text-base border-l-2 border-slate-600 pl-4">
            <div>
              <strong className="text-white block mb-1">1. Assignment</strong>
              Each player is secretly assigned a role: King, Police, Robber, or
              Thief.
            </div>
            <div>
              <strong className="text-white block mb-1">2. The Hunt</strong>
              The <span className="text-blue-400 font-bold">Police</span> must
              reveal themselves and guess who holds a specific criminal card
              (e.g., "Find the Robber").
            </div>
            <div>
              <strong className="text-white block mb-1">3. Scoring</strong>
              <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-400">
                <li>
                  <span className="text-yellow-400">King:</span> Always gets{" "}
                  <strong>10 pts</strong>.
                </li>
                <li>
                  <span className="text-blue-400">Police:</span> Gets{" "}
                  <strong>8 pts</strong> if they guess correctly.{" "}
                  <strong>0 pts</strong> if wrong.
                </li>
                <li>
                  <span className="text-red-400">Criminals:</span> Get points (6
                  or 4) only if the Police guesses <strong>WRONG</strong>. If
                  caught, they get <strong>0 pts</strong>.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div className="p-4 md:p-6 bg-slate-900 border-t border-slate-700 text-center">
        <button
          onClick={onClose}
          className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-12 py-3 rounded-xl font-bold text-lg shadow-lg transition-all"
        >
          Let's Play!
        </button>
      </div>
    </div>
  </div>
);

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
        x: Math.random() * 100,
        y: -10,
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

  const [roomCode, setRoomCode] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);

  // Lobby Rounds State
  const [lobbyRounds, setLobbyRounds] = useState(25);
  const [roundsError, setRoundsError] = useState("");

  // New State for confirmation modal
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Celebration States
  const [showConfetti, setShowConfetti] = useState(false);
  const [showKingEffect, setShowKingEffect] = useState(false);
  const [shakeScreen, setShakeScreen] = useState(false);

  //read and fill global name
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem("gameHub_playerName") || "",
  );
  //set global name for all game
  useEffect(() => {
    if (playerName) localStorage.setItem("gameHub_playerName", playerName);
  }, [playerName]);

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

  // --- NEW: Restore Session ---
  useEffect(() => {
    if (user && view === "menu") {
      const savedRoomId = localStorage.getItem("police_room_id");
      const savedPlayerName = localStorage.getItem("police_player_name");

      if (savedRoomId && savedPlayerName) {
        setLoading(true);
        setPlayerName(savedPlayerName);
        setRoomId(savedRoomId);
      }
    }
  }, [user, view]);

  useEffect(() => {
    if (!roomId || !user) return;
    const roomRef = doc(
      db,
      "artifacts",
      GAME_APP_ID,
      "public",
      "data",
      "rooms",
      roomId,
    );

    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameState({ id: docSnap.id, ...data });

        const amIInRoom = data.players.some((p) => p.id === user.uid);
        if (!amIInRoom) {
          setRoomId(null);
          setView("menu");
          setError("You were removed from the Station.");
          localStorage.removeItem("police_room_id");
          localStorage.removeItem("police_player_name");
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
        setError("The Station has been closed! (Room Deleted)");
        localStorage.removeItem("police_room_id");
        localStorage.removeItem("police_player_name");
      }
    });
    return () => unsubscribe();
  }, [roomId, user]);

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
        (p) => p.currentRole === "POLICE",
      );
      if (policePlayer && policePlayer.isBot) {
        const timer = setTimeout(() => {
          const validTargets = gameState.players.filter(
            (p) => p.id !== policePlayer.id && p.currentRole !== "KING",
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

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "game_hub_settings", "config"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data[GAME_ID]?.maintenance) {
          setIsMaintenance(true);
        } else {
          setIsMaintenance(false);
        }
      }
    });
    return () => unsub();
  }, []);

  if (isMaintenance) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white p-4 text-center">
        <div className="bg-orange-500/10 p-8 rounded-2xl border border-orange-500/30">
          <Hammer
            size={64}
            className="text-orange-500 mx-auto mb-4 animate-bounce"
          />
          <h1 className="text-3xl font-bold mb-2">Under Maintenance</h1>
          <p className="text-gray-400">
            All units return to HQ. Shift change in progress.
          </p>
        </div>
        <div className="h-8"></div>
        <a href="https://rawfidkshuvo.github.io/gamehub/">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="text-center pb-12 animate-pulse">
              <div className="inline-flex items-center gap-3 px-8 py-4 bg-slate-900/50 rounded-full border border-indigo-500/20 text-indigo-300 font-bold tracking-widest text-sm uppercase backdrop-blur-sm">
                <Sparkles size={16} /> Visit Gamehub...Try our other releases...{" "}
                <Sparkles size={16} />
              </div>
            </div>
          </div>
        </a>
      </div>
    );
  }

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
      newRoomId,
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

      // Save Session
      localStorage.setItem("police_room_id", newRoomId);
      localStorage.setItem("police_player_name", playerName);

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
      roomCode,
    );
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) throw new Error("Room not found.");
      const data = snap.data();
      if (data.players.length >= 4) {
        // Allow rejoin if already in list
        if (!data.players.some((p) => p.id === user.uid)) {
          throw new Error("Room full.");
        }
      }

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

      // Save Session
      localStorage.setItem("police_room_id", roomCode);
      localStorage.setItem("police_player_name", playerName);

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
        roomId,
      );
      const docSnap = await getDoc(roomRef);
      if (docSnap.exists()) {
        const data = docSnap.data();

        const isHost = data.hostId === user.uid;

        if (isHost) {
          // If Host leaves, destroy the room completely
          await deleteDoc(roomRef);
        } else {
          // Guest Logic
          if (data.status === "lobby") {
            const updatedPlayers = data.players.filter(
              (p) => p.id !== user.uid,
            );
            await updateDoc(roomRef, { players: updatedPlayers });
          } else {
            // In Game: Guest leaves, trigger finish for everyone logic
            await handleGameAbandon(roomRef, data);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    // Clear Session
    localStorage.removeItem("police_room_id");
    localStorage.removeItem("police_player_name");

    setRoomId(null);
    setView("menu");
    setShowLeaveConfirm(false);
  };

  const handleGameAbandon = async (roomRef, data) => {
    // If anyone leaves during game, game ends.
    await updateDoc(roomRef, {
      status: "finished",
      players: data.players.filter((p) => p.id !== user.uid), // Remove the leaver
    });
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
        roomId,
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

  const copyToClipboard = () => {
    try {
      navigator.clipboard.writeText(roomId);
      triggerFeedback("neutral", "COPIED!", "", CheckCircle);
    } catch (e) {
      const el = document.createElement("textarea");
      el.value = roomId;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      triggerFeedback("neutral", "COPIED!", "", CheckCircle);
    }
  };

  const resetToLobby = async () => {
    if (!gameState || gameState.hostId !== user.uid) return;

    // Reset players logic
    const resetPlayers = gameState.players.map((p) => ({
      ...p,
      totalScore: 0,
      currentRole: null,
      roundScore: 0,
    }));

    await updateDoc(
      doc(db, "artifacts", GAME_APP_ID, "public", "data", "rooms", roomId),
      {
        gameInstanceId: Date.now(),
        currentRound: 0,
        status: "lobby",
        players: resetPlayers,
        roundHistory: [],
        readyPlayers: [],
        gameReadyPlayers: [],
        turnState: "IDLE",
      },
    );
    setShowLeaveConfirm(false);
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
      },
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
      roomId,
    );
    if (!gameState.readyPlayers?.includes(user.uid)) {
      await updateDoc(roomRef, {
        readyPlayers: arrayUnion(user.uid),
      });
    }
  };

  const executeNextRound = async () => {
    if (gameState.currentRound >= gameState.maxRounds) {
      await updateDoc(
        doc(db, "artifacts", GAME_APP_ID, "public", "data", "rooms", roomId),
        {
          status: "finished",
        },
      );
      return;
    }

    const deck = shuffle(["KING", "POLICE", "ROBBER", "THIEF"]);
    const nextRoundNum = gameState.currentRound + 1;
    // Odd rounds (1,3,5) -> find THIEF, Even rounds (2,4,6) -> find ROBBER
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
      },
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
      },
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
      },
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
      },
    );
  };

  // --- Views ---

  if (view === "menu") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        <FloatingBackground />
        {showGuide && <GameGuideModal onClose={() => setShowGuide(false)} />}

        <div className="z-10 mb-10 text-center animate-in fade-in zoom-in duration-700">
          <Siren
            size={64}
            className="text-red-700 mx-auto mb-4 animate-bounce drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
          />
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-linear-to-b from-red-700 to-blue-600 font-serif tracking-widest drop-shadow-md">
            POLICE HUNT
          </h1>
          <p className="text-slate-400 tracking-[0.3em] uppercase mt-2 font-bold">
            The Heist
          </p>
        </div>

        <div className="max-w-md w-full bg-slate-800/90 backdrop-blur border border-slate-600 p-8 rounded-2xl shadow-2xl z-10 animate-in slide-in-from-bottom-10 duration-700 delay-100">
          {error && (
            <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4 text-sm text-center border border-red-800">
              {error}
            </div>
          )}
          <input
            className="w-full bg-slate-900 border border-slate-600 p-3 rounded mb-4 text-white placeholder-slate-500 focus:border-blue-500 outline-none transition-colors"
            placeholder="Your Nickname"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />

          <button
            onClick={createRoom}
            disabled={loading}
            className="w-full bg-linear-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 p-4 rounded-xl font-bold mb-4 flex items-center justify-center gap-2 border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.2)] transition-all text-black"
          >
            <Siren size={20} /> Generate Crime Scene
          </button>

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              className="w-full sm:flex-1 bg-slate-900 border border-slate-600 p-3 rounded text-white placeholder-slate-500 uppercase font-mono tracking-wider focus:border-blue-500 outline-none"
              placeholder="ROOM CODE"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            />
            <button
              onClick={joinRoom}
              disabled={loading}
              className="w-full sm:w-auto bg-blue-700 hover:bg-blue-600 border border-blue-500 px-6 py-3 rounded font-bold transition-colors shadow-lg"
            >
              Join
            </button>
          </div>

          <button
            onClick={() => setShowGuide(true)}
            className="w-full mt-4 text-sm text-slate-400 hover:text-white flex items-center justify-center gap-2 py-2 transition-colors"
          >
            <BookOpen size={16} /> Penal Codes
          </button>
        </div>
        <div className="absolute bottom-4 text-slate-600 text-xs text-center">
          Inspired by Chor, Dakaat, Babu, Police. A tribute game.
          <br />
          Developed by <strong>RAWFID K SHUVO</strong>. Visit{" "}
          <a
            href="https://rawfidkshuvo.github.io/gamehub/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-500 underline hover:text-red-600"
          >
            GAMEHUB
          </a>{" "}
          for more games.
        </div>
      </div>
    );
  }

  if (view === "lobby" && gameState) {
    const isHost = gameState.hostId === user.uid;
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col items-center relative overflow-hidden">
        <FloatingBackground />
        <PoliceLogoBig />
        {showLeaveConfirm && (
          <LeaveConfirmModal
            onConfirmLeave={leaveRoom}
            onConfirmLobby={() => {
              resetToLobby();
              setShowLeaveConfirm(false);
            }}
            onCancel={() => setShowLeaveConfirm(false)}
            isHost={isHost}
            inGame={false}
          />
        )}
        <div className="w-full max-w-lg z-10 bg-slate-800/90 p-8 rounded-2xl border border-slate-700 shadow-2xl mb-4">
          <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
            {/* Grouping Title and Copy Button together on the left */}
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold font-serif text-blue-400">
                Station:{" "}
                <span className="text-white font-mono">{gameState.id}</span>
              </h2>
              <button
                onClick={copyToClipboard}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                title="Copy Room ID"
              >
                <Copy size={16} />
              </button>
            </div>
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="bg-slate-700 p-2 rounded hover:bg-red-900/50 hover:text-red-400 transition-colors"
              title="Leave Room"
            >
              <LogOut size={20} />
            </button>
          </div>

          {/* Round Settings Area */}
          <div className="bg-slate-900/50 rounded-xl p-4 mb-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-xs tracking-wider">
                <Settings size={16} /> Rounds
              </div>
              {gameState.hostId === user.uid ? (
                <div className="flex flex-col items-end">
                  <input
                    type="number"
                    className="bg-slate-800 text-center w-20 p-2 rounded border border-slate-600 focus:border-yellow-500 outline-none font-bold"
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

          <div className="bg-slate-900/50 rounded-xl p-6 mb-6 border border-slate-700">
            <div className="flex justify-between mb-4 text-xs font-bold text-slate-500 uppercase">
              <span>Squad</span>
              <span>{gameState.players.length} / 4</span>
            </div>
            {gameState.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-slate-800 p-3 rounded mb-2 border border-slate-700"
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
                {/* Trash Icon for Host to Kick Players */}
                {gameState.hostId === user.uid && p.id !== user.uid && (
                  <button
                    onClick={() => kickPlayer(p.id)}
                    className="p-2 hover:bg-red-900/50 rounded text-red-400 transition-colors"
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
            <div className="text-center text-slate-400 animate-pulse italic">
              Waiting for Captain to start...
            </div>
          )}
        </div>
        <PoliceLogo />
      </div>
    );
  }

  if (view === "game" && gameState) {
    const me = gameState.players.find((p) => p.id === user.uid);
    if (!me) return null;

    const currentPolice = gameState.players.find(
      (p) => p.currentRole === "POLICE",
    );
    const isPolice = me.currentRole === "POLICE";
    const iHaveVoted = gameState.readyPlayers?.includes(user.uid);
    const humanCount = gameState.players.filter((p) => !p.isBot).length;
    const voteCount = gameState.readyPlayers?.length || 0;
    const isHost = gameState.hostId === user.uid;

    return (
      <div
        className={`min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden transition-transform duration-100 font-sans ${
          shakeScreen ? "translate-x-1" : ""
        }`}
      >
        <FloatingBackground />

        {shakeScreen && (
          <div className="absolute inset-0 bg-red-500/20 z-40 pointer-events-none" />
        )}
        {showConfetti && <Confetti type="colorful" />}
        {showKingEffect && <Confetti type="gold" />}

        {showLeaveConfirm && (
          <LeaveConfirmModal
            onCancel={() => setShowLeaveConfirm(false)}
            onConfirmLeave={leaveRoom}
            onConfirmLobby={() => {
              resetToLobby();
              setShowLeaveConfirm(false);
            }}
            isHost={isHost}
            inGame={true}
          />
        )}

        {showGuide && <GameGuideModal onClose={() => setShowGuide(false)} />}

        {/* Header */}
        <div className="bg-slate-800/90 backdrop-blur-md p-3 flex justify-between items-center shadow-lg z-10 border-b border-slate-700">
          <div>
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wide">
              Round
            </div>
            <div className="font-bold text-xl leading-none text-blue-400">
              {gameState.currentRound}{" "}
              <span className="text-slate-500 text-sm">
                / {gameState.maxRounds}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowGuide(true)}
              className="bg-slate-700 p-2 rounded hover:bg-slate-600 text-slate-300"
              title="Game Rules"
            >
              <BookOpen size={20} />
            </button>
            <button
              onClick={() => setShowScoreboard(true)}
              className="bg-slate-700 p-2 rounded hover:bg-slate-600 text-slate-300"
              title="Scoreboard"
            >
              <Trophy size={20} />
            </button>
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="bg-slate-700 p-2 rounded hover:bg-red-900/50 hover:text-red-400 transition-colors text-slate-300"
              title="Leave Game"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 p-4 flex flex-col items-center justify-center gap-6 z-10">
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
                  Find{" "}
                  <span
                    className={
                      gameState.roundTarget === "THIEF"
                        ? "text-red-300"
                        : "text-red-500"
                    }
                  >
                    {gameState.roundTarget}
                  </span>
                </div>
                <div className="text-sm bg-slate-800/80 p-2 rounded-lg border border-slate-700 animate-pulse text-blue-300 backdrop-blur-sm">
                  {isPolice
                    ? "Click a player to guess!"
                    : `${currentPolice?.name} is investigating...`}
                </div>
              </>
            ) : (
              <div className="bg-slate-800/90 backdrop-blur px-6 py-4 rounded-xl border border-slate-600 shadow-xl w-full">
                <div className="text-lg font-bold mb-1 text-center text-white">
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
                                relative p-4 rounded-xl border-2 flex flex-col items-center justify-center aspect-3/4 transition-all backdrop-blur-sm
                                ${
                                  isMe
                                    ? "bg-slate-800/90 shadow-[0_0_20px_rgba(6,182,212,0.4)] border-green-400 ring-2 ring-cyan-400/30 transform scale-105 z-10"
                                    : "bg-slate-800/80 border-slate-700"
                                }
                                ${
                                  canSelect
                                    ? "cursor-pointer hover:scale-105 border-red-400 bg-red-900/20 shadow-[0_0_15px_rgba(248,113,113,0.5)]"
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

          <div className="mt-auto bg-slate-800/90 backdrop-blur w-full max-w-md p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-lg">
            <span className="text-slate-400 text-sm font-bold uppercase">
              My Score
            </span>
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
                  (a, b) => b.totalScore - a.totalScore,
                );
                const topScore = sortedPlayers[0]?.totalScore || 0;
                const winners = sortedPlayers.filter(
                  (p) => p.totalScore === topScore,
                );
                const isTie = winners.length > 1;

                return (
                  <>
                    {/* Winner Banner */}
                    {gameState.status === "finished" && (
                      <div className="bg-linear-to-r from-yellow-600 to-yellow-800 p-4 text-center">
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
                  <div className="flex flex-col gap-3">
                    {gameState.hostId === user.uid ? (
                      <button
                        onClick={restartGame}
                        className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-lg shadow-lg"
                      >
                        <RotateCcw /> Play Again
                      </button>
                    ) : (
                      <div className="text-center text-slate-400 italic">
                        Waiting for Host to restart...
                      </div>
                    )}

                    {/* Exit Button for Everyone */}
                    <button
                      onClick={leaveRoom}
                      className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-bold text-white border border-slate-500"
                    >
                      Exit to Menu
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <PoliceLogo />
      </div>
    );
  }

  return (
    <div className="text-white text-center p-10">Loading Game Resources...</div>
  );
}
