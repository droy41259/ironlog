import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Trash2, Save, History, Dumbbell, Calendar, Settings2, 
  TrendingUp, CheckCircle2, Circle, Activity, Home, Trophy, 
  Zap, Sparkles, Loader2, X, ChevronDown, ChevronUp, Repeat, 
  BarChart3, Layers, MessageSquareQuote, Moon, Sun, LogOut, Mail, 
  Lock, User, AlertCircle, Download, Link, Unlink, Play, Clock, 
  ArrowRight, Send, Bot, MessageSquare, ChevronRight
} from 'lucide-react';

// npm install firebase
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc, 
  doc,
  limit
} from 'firebase/firestore';

// --- CONFIGURATION SECTION ---

const appId = typeof __app_id !== 'undefined' ? __app_id : 'ironlog-production';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyChWVF80MJkmabCDXAT40mk9jBQGhIT-1g",
  authDomain: "ironlog-ed2d9.firebaseapp.com",
  projectId: "ironlog-ed2d9",
  storageBucket: "ironlog-ed2d9.firebasestorage.app",
  messagingSenderId: "561822591070",
  appId: "1:561822591070:web:e214a21713b85d19dfaccf",
  measurementId: "G-4CX79RQSNQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Helper Functions ---

async function callGemini(prompt, systemInstruction = "You are a helpful assistant.") {
  const url = '/api/gemini'; 
  
  const payload = {
    prompt: prompt,
    systemInstruction: systemInstruction
  };

  const maxRetries = 2;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Backend API not found. Please deploy to Vercel.");
        }
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      // Try parsing JSON if the AI returns JSON string, otherwise return text
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch (e) {
      console.error("AI Call Failed:", e);
      attempt++;
      if (attempt >= maxRetries) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// Helper to group exercises into supersets
const groupExercises = (exercises) => {
  if (!exercises) return [];
  const groups = [];
  let currentGroup = [];

  exercises.forEach((ex, index) => {
    const isSuperset = ex.supersetId;
    const prevEx = exercises[index - 1];

    if (index === 0) {
      currentGroup.push(ex);
    } else {
      if (isSuperset && prevEx && prevEx.supersetId === isSuperset) {
        currentGroup.push(ex);
      } else {
        groups.push(currentGroup);
        currentGroup = [ex];
      }
    }
  });
  if (currentGroup.length > 0) groups.push(currentGroup);
  return groups;
};

// Helper to format "X days ago"
const getDaysAgo = (date) => {
  const diffTime = Math.abs(new Date() - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
};

// --- Interactive Chart Component ---
const MiniChart = ({ data, color = "#3b82f6", height = 200 }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length < 2) return (
    <div className="flex flex-col items-center justify-center h-48 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-dashed border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500">
      <BarChart3 className="w-8 h-8 opacity-20 mb-2" />
      <span className="text-xs italic">Log more workouts to see trends</span>
    </div>
  );
  
  const padding = 5;
  const maxVal = Math.max(...data.map(d => d.val));
  const minVal = Math.min(...data.map(d => d.val));
  const range = maxVal - minVal || 1;
  const getX = (i) => (i / (data.length - 1)) * (100 - padding * 2) + padding;
  const getY = (val) => {
    if (range === 0) return 50;
    return 100 - padding - ((val - minVal) / range) * (100 - padding * 2);
  };
  const points = data.map((d, i) => `${getX(i)},${getY(d.val)}`).join(' ');
  const areaPoints = `${padding},100 ${points} ${100-padding},100`;

  return (
    <div className="w-full relative group select-none" onMouseLeave={() => setHoveredIndex(null)}>
      {hoveredIndex !== null && (
        <div 
          className="absolute z-10 top-0 left-0 pointer-events-none transition-all duration-75 ease-out"
          style={{ 
            left: `${getX(hoveredIndex)}%`, 
            top: `${getY(data[hoveredIndex].val)}%`,
            transform: 'translate(-50%, -130%)'
          }}
        >
          <div className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] py-1.5 px-3 rounded-lg shadow-xl flex flex-col items-center whitespace-nowrap animate-in zoom-in-95 duration-100">
             <span className="font-bold text-xs">{data[hoveredIndex].val.toLocaleString()} {data[hoveredIndex].unit}</span>
             <span className="text-gray-400 dark:text-gray-500 font-medium text-[9px] mt-0.5">{data[hoveredIndex].label}</span>
             <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-gray-900 dark:border-t-white"></div>
          </div>
        </div>
      )}
      <div className="h-48 w-full">
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[20, 40, 60, 80].map(p => (
            <line key={p} x1="0" y1={p} x2="100" y2={p} stroke="currentColor" className="text-gray-100 dark:text-zinc-800" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          ))}
          <polygon points={areaPoints} fill={`url(#gradient-${color})`} className="transition-all duration-300" />
          <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="transition-all duration-300 drop-shadow-sm" />
          {data.map((d, i) => (
            <g key={i} onMouseEnter={() => setHoveredIndex(i)} className="cursor-pointer">
              <circle cx={getX(i)} cy={getY(d.val)} r="6" fill="transparent" /> 
              <circle 
                cx={getX(i)} 
                cy={getY(d.val)} 
                r={hoveredIndex === i ? 3 : 1.5} 
                fill={color} 
                stroke="white" 
                strokeWidth={hoveredIndex === i ? 1 : 0}
                className={`transition-all duration-200 ${hoveredIndex === i ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} 
                vectorEffect="non-scaling-stroke"
              />
               {hoveredIndex === i && (
                  <circle cx={getX(i)} cy={getY(d.val)} r="6" fill={color} opacity="0.2" vectorEffect="non-scaling-stroke" />
               )}
            </g>
          ))}
        </svg>
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-zinc-600 mt-2 px-1 font-medium">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
};

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // AUTHENTICATION
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (e) {
          console.error("System token failed", e);
        }
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false); 
    });
    return () => unsubscribe();
  }, []);

  // DATABASE
  useEffect(() => {
    if (!user) {
      setWorkouts([]);
      return;
    }
    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'workouts'),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date ? doc.data().date.toDate() : new Date()
      }));
      setWorkouts(data);
    });
    return () => unsubscribe();
  }, [user]);

  const handleRepeat = (workout) => {
    const template = {
      name: workout.name,
      exercises: workout.exercises.map(ex => ({
        ...ex,
        id: crypto.randomUUID(),
        supersetId: ex.supersetId || null,
        sets: ex.sets.map(s => ({ ...s, id: crypto.randomUUID(), completed: false }))
      }))
    };
    localStorage.setItem(`ironlog_draft_${user.uid}`, JSON.stringify(template));
    setActiveTab('log');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setActiveTab('home');
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-blue-500 font-medium animate-pulse bg-gray-50 dark:bg-zinc-950 dark:text-blue-400">Loading IronLog...</div>;

  if (!user) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <AuthScreen darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-800 dark:text-zinc-200 pb-24 font-sans select-none transition-colors duration-300">
        <nav className="bg-white dark:bg-zinc-900 shadow-sm dark:shadow-zinc-900 sticky top-0 z-10 px-4 py-3 flex justify-between items-center border-b border-transparent dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-blue-200 dark:shadow-none shadow-md">
              <Activity className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">IronLog</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className="p-2 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </nav>

        <main className="max-w-md mx-auto p-4">
          {activeTab === 'home' && <Dashboard workouts={workouts} setActiveTab={setActiveTab} onRepeat={handleRepeat} user={user} />}
          {activeTab === 'log' && <WorkoutLogger user={user} workouts={workouts} onSave={() => setActiveTab('home')} />}
          {activeTab === 'history' && <WorkoutHistory user={user} workouts={workouts} onRepeat={handleRepeat} />}
          {activeTab === 'coach' && <CoachChat user={user} workouts={workouts} />}
        </main>

        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 px-6 py-2 flex justify-around items-center z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${activeTab === 'home' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-zinc-800' : 'text-gray-400 dark:text-zinc-500'}`}>
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-bold">Home</span>
          </button>
          <div className="relative -top-6">
            <button onClick={() => setActiveTab('log')} className={`flex flex-col items-center justify-center w-14 h-14 rounded-full shadow-lg border-4 border-gray-50 dark:border-zinc-950 transition-all ${activeTab === 'log' ? 'bg-blue-600 text-white scale-110' : 'bg-blue-600 text-white hover:scale-105'}`}>
              <Plus className="w-7 h-7" />
            </button>
          </div>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${activeTab === 'history' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-zinc-800' : 'text-gray-400 dark:text-zinc-500'}`}>
            <History className="w-5 h-5" />
            <span className="text-[10px] font-bold">History</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- COACH CHAT COMPONENT (FIXED: Memory + JSON Formatting) ---
function CoachChat({ user, workouts }) {
  const [messages, setMessages] = useState([
    { role: 'model', text: `Hi! I'm your IronLog Coach. I have access to your ${workouts.length} logged workouts. Ask me about your progress, routine ideas, or form tips!` }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Recursively format unknown JSON objects into readable text
  const formatRecursive = (obj, depth = 0) => {
    if (typeof obj !== 'object' || obj === null) return String(obj);
    if (Array.isArray(obj)) {
      return obj.map(item => `\n${'  '.repeat(depth)}• ${formatRecursive(item, depth + 1)}`).join('');
    }
    return Object.entries(obj).map(([key, val]) => {
      // Skip internal keys if the AI returns them
      if (['response', 'message', 'text', 'answer'].includes(key.toLowerCase()) && typeof val === 'string') return val;
      return `\n${'  '.repeat(depth)}**${key.replace(/_/g, ' ')}**: ${formatRecursive(val, depth + 1)}`;
    }).join('');
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    const newMessages = [...messages, { role: 'user', text: userMsg }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      // 1. Build Context
      const recentWorkouts = workouts.slice(0, 10).map(w => ({
        date: w.date.toLocaleDateString(),
        name: w.name,
        volume: w.totalVolume,
        exercises: w.exercises.map(e => e.name).join(', ')
      }));

      // Calculate simple PRs for context
      const records = {};
      workouts.forEach(w => {
        w.exercises.forEach(e => {
          const maxWeight = Math.max(...(e.sets || []).map(s => Number(s.kg) || 0));
          if (!records[e.name] || maxWeight > records[e.name]) records[e.name] = maxWeight;
        });
      });

      // 2. Build Conversation History (Fixes "No Memory" issue)
      // We grab the last 10 messages so the AI knows what was just said
      const historyContext = newMessages.slice(-10).map(m => 
        `${m.role === 'user' ? 'User' : 'Coach'}: ${m.text}`
      ).join('\n');

      const systemInstruction = `
        You are an elite fitness coach for the IronLog app. 
        
        USER DATA CONTEXT:
        - Recent Workouts: ${JSON.stringify(recentWorkouts)}
        - Personal Records (Est): ${JSON.stringify(records)}
        
        CONVERSATION HISTORY (Most recent last):
        ${historyContext}
        
        INSTRUCTIONS:
        1. Answer the user's question concisely.
        2. USE THE DATA. If they ask "Is my bench going up?", look at the records provided. 
        3. GUARDRAILS: Only answer questions about fitness, workouts, anatomy, or nutrition/diet.
        4. **CRITICAL: Respond in readable MARKDOWN format.** Use bold text and bullet lists. 
        5. **ABSOLUTELY NO JSON.** Do not return code blocks. Write naturally.
      `;

      // 3. Call AI
      // We send the history inside the prompt context as well to be safe
      const response = await callGemini(userMsg, systemInstruction);
      
      let textResponse = "";

      // 4. Robust Handling: Fixes "[object Object]" issues
      if (typeof response === 'object' && !response.text) {
        // If AI ignores instructions and returns JSON, manually format it
        if (response.response || response.message || response.answer) {
             textResponse = response.response || response.message || response.answer;
             // If there are other useful keys (like 'principles'), append them
             const otherKeys = Object.keys(response).filter(k => !['response','message','answer','text'].includes(k));
             if (otherKeys.length > 0) {
                 textResponse += "\n" + formatRecursive(Object.fromEntries(otherKeys.map(k => [k, response[k]])));
             }
        } else {
             // Fallback: fully format the object
             textResponse = formatRecursive(response);
        }
      } else if (typeof response === 'object' && response.text) {
        textResponse = response.text;
      } else {
        textResponse = String(response);
      }

      setMessages(prev => [...prev, { role: 'model', text: textResponse }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble analyzing your data right now." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const suggestions = [
    "What's my strongest lift?",
    "Suggest a leg workout",
    "How is my volume trending?",
    "Why is my progress stalling?"
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-b-2xl shadow-lg -mx-4 -mt-4 mb-4">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <Bot className="w-6 h-6 text-blue-200" /> AI Coach
        </h2>
        <p className="text-blue-100 text-xs">Powered by your training data</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 px-2 pb-4 no-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 border border-gray-100 dark:border-zinc-700 rounded-bl-none shadow-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-zinc-800 p-3 rounded-2xl rounded-bl-none border border-gray-100 dark:border-zinc-700 shadow-sm flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-auto">
        {messages.length < 3 && (
           <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar px-1">
             {suggestions.map((s, i) => (
               <button 
                 key={i} 
                 onClick={() => { setInput(s); handleSend(); }} 
                 className="whitespace-nowrap bg-blue-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 text-xs px-3 py-1.5 rounded-full border border-blue-100 dark:border-zinc-700 hover:bg-blue-100 transition-colors"
               >
                 {s}
               </button>
             ))}
           </div>
        )}
        
        <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-gray-200 dark:border-zinc-800 flex items-center gap-2 shadow-sm">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask your coach..."
            className="flex-1 bg-transparent px-2 py-2 text-sm outline-none text-gray-800 dark:text-white placeholder-gray-400"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="p-2 bg-blue-600 rounded-lg text-white hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- EXISTING COMPONENTS (Unchanged logic, just re-declared for single file) ---

function AuthScreen({ darkMode, setDarkMode }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      let msg = err.message;
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) msg = "Incorrect email or password.";
      else if (msg.includes('email-already-in-use')) msg = "Email already in use.";
      else if (msg.includes('weak-password')) msg = "Password too weak.";
      setError(msg.replace('Firebase: ', '').replace('auth/', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 transition-colors duration-300">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-4 rounded-2xl shadow-xl shadow-blue-200 dark:shadow-blue-900/20 mb-4">
            <Activity className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">IronLog</h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-2">Track your progress, hit your goals.</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-zinc-800">
          <div className="flex gap-4 mb-8 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button onClick={() => { setIsLogin(true); setError(''); }} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-zinc-500'}`}>Sign In</button>
            <button onClick={() => { setIsLogin(false); setError(''); }} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-zinc-500'}`}>Sign Up</button>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase">Email</label>
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800 px-4 py-3 rounded-xl border border-transparent focus-within:border-blue-500 transition-all">
                <Mail className="w-5 h-5 text-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="bg-transparent w-full outline-none text-gray-800 dark:text-white" required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase">Password</label>
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800 px-4 py-3 rounded-xl border border-transparent focus-within:border-blue-500 transition-all">
                <Lock className="w-5 h-5 text-gray-400" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="bg-transparent w-full outline-none text-gray-800 dark:text-white" required minLength={6} />
              </div>
            </div>
            {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex justify-center items-center">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? "Sign In" : "Create Account")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ workouts, setActiveTab, onRepeat, user }) {
  const [coachTip, setCoachTip] = useState(null);
  const [loadingTip, setLoadingTip] = useState(false);
  const [chartMetric, setChartMetric] = useState('volume');

  const quickStartRoutines = useMemo(() => {
    const unique = [];
    const names = new Set();
    workouts.forEach(w => {
      const normalizedName = w.name.trim();
      if (!normalizedName) return;
      if (!names.has(normalizedName)) {
        names.add(normalizedName);
        unique.push(w);
      }
    });
    return unique.slice(0, 4);
  }, [workouts]);

  const personalRecords = useMemo(() => {
    const records = {};
    workouts.forEach(workout => {
      if(!workout.exercises) return;
      workout.exercises.forEach(ex => {
        const name = ex.name.trim();
        if (!name) return;
        let bestSetInSession = { kg: 0, reps: 0 };
        (ex.sets || []).forEach(s => {
          const kg = Number(s.kg) || 0;
          const reps = Number(s.reps) || 0;
          if (kg > bestSetInSession.kg || (kg === bestSetInSession.kg && reps > bestSetInSession.reps)) {
            bestSetInSession = { kg, reps };
          }
        });
        if (bestSetInSession.kg > 0) {
            if (!records[name]) {
                records[name] = { ...bestSetInSession, date: workout.date };
            } else {
                const currentRecord = records[name];
                if (bestSetInSession.kg > currentRecord.kg || (bestSetInSession.kg === currentRecord.kg && bestSetInSession.reps > currentRecord.reps)) {
                    records[name] = { ...bestSetInSession, date: workout.date };
                }
            }
        }
      });
    });
    return Object.entries(records).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.kg - a.kg);
  }, [workouts]);

  const chartData = useMemo(() => {
    const sorted = workouts.slice().sort((a, b) => a.date - b.date);
    const recent = sorted.slice(-7);
    return recent.map(w => {
      const dateLabel = w.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (chartMetric === 'volume') return { val: w.totalVolume || 0, label: dateLabel, unit: 'kg' };
      const totalSets = w.exercises?.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0) || 0;
      return { val: totalSets, label: dateLabel, unit: 'sets' };
    });
  }, [workouts, chartMetric]);

  const weeklyProgress = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0,0,0,0);
    return workouts.filter(w => w.date >= startOfWeek).length;
  }, [workouts]);

  const getCoachInsight = async () => {
    setLoadingTip(true);
    try {
      const recentHistory = workouts.slice(0, 3).map(w => ({
        name: w.name,
        date: w.date.toDateString(),
        volume: w.totalVolume,
        exercises: w.exercises.map(e => e.name).join(', ')
      }));
      const prompt = `Analyze these recent workouts: ${JSON.stringify(recentHistory)}. Give me one short, specific, and motivating insight or tip (under 30 words). Return valid JSON: { "tip": "string" }`;
      const result = await callGemini(prompt, "You are an elite fitness coach.");
      setCoachTip(result?.tip || "Keep pushing!");
    } catch (e) {
      setCoachTip("Consistency is key! Keep pushing your limits.");
    } finally {
      setLoadingTip(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-400 text-sm">
             <User className="w-3 h-3" /> {user.email || 'User'}
          </div>
        </div>
        
        {/* MODIFIED HEADER: Coach button added here next to session counter */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('coach')} 
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200 dark:shadow-none hover:scale-105 transition-transform"
          >
            <Bot className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-0.5">Ask Coach</span>
          </button>
          
          <div className="bg-blue-50 dark:bg-zinc-900 text-blue-700 dark:text-blue-400 px-3 py-2 rounded-xl flex items-center gap-2 shadow-sm border border-blue-100 dark:border-zinc-800">
            <div className="relative">
              <Circle className="w-8 h-8 text-blue-200 dark:text-blue-900" strokeWidth={4} />
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{weeklyProgress}</div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] text-blue-400 font-bold uppercase">This Week</span>
              <span className="text-xs font-bold">Sessions</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-purple-200 dark:shadow-none relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles size={100} /></div>
        <h2 className="font-bold flex items-center gap-2 relative z-10"><Sparkles className="w-4 h-4 text-yellow-300" /> Coach's Insight</h2>
        <div className="mt-3 min-h-[60px] relative z-10">
          {loadingTip ? (
            <div className="flex items-center gap-2 text-purple-200 animate-pulse"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</div>
          ) : coachTip ? (
            <div className="text-lg font-medium leading-relaxed animate-in fade-in">"{coachTip}"</div>
          ) : (
            <div className="text-purple-100 text-sm">Get personalized advice based on your recent training.</div>
          )}
        </div>
        {!coachTip && !loadingTip && (
          <button onClick={getCoachInsight} className="mt-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all flex items-center gap-2"><Zap className="w-4 h-4" /> Get Insight</button>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div><h2 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><Activity className="w-5 h-5 text-blue-500" /> {chartMetric === 'volume' ? 'Volume Load' : 'Training Frequency'}</h2><p className="text-gray-400 dark:text-zinc-500 text-xs">{chartMetric === 'volume' ? 'Total kg lifted' : 'Total sets performed'} (Last 7 Sessions)</p></div>
          <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
            <button onClick={() => setChartMetric('volume')} className={`p-1.5 rounded-md transition-all ${chartMetric === 'volume' ? 'bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-white' : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600'}`} title="Volume (kg)"><BarChart3 className="w-4 h-4" /></button>
            <button onClick={() => setChartMetric('sets')} className={`p-1.5 rounded-md transition-all ${chartMetric === 'sets' ? 'bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-white' : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600'}`} title="Sets"><Layers className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="w-full"><MiniChart data={chartData} color={chartMetric === 'volume' ? '#3b82f6' : '#8b5cf6'} /></div>
      </div>

      <div>
        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-3">
          <Play className="w-5 h-5 text-green-500 fill-current" /> Quick Start
        </h3>
        {quickStartRoutines.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {quickStartRoutines.map((routine) => (
              <button key={routine.id} onClick={() => onRepeat(routine)} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm p-4 rounded-xl flex flex-col items-start hover:bg-gray-50 dark:hover:bg-zinc-800 hover:border-blue-200 dark:hover:border-blue-900 transition-all group text-left relative overflow-hidden">
                <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="w-4 h-4 text-blue-500" /></div>
                <div className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1 mb-1">{routine.name}</div>
                <div className="text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-1.5"><Clock className="w-3 h-3" /> {getDaysAgo(routine.date)}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 bg-gray-50 dark:bg-zinc-900 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
             <p className="text-sm text-gray-500 dark:text-zinc-500 mb-2">No routines found yet.</p>
             <button onClick={() => setActiveTab('log')} className="text-blue-600 dark:text-blue-400 text-sm font-bold hover:underline">Log a workout</button>
          </div>
        )}
      </div>

      {workouts.length === 0 && (
        <button onClick={() => setActiveTab('log')} className="w-full py-4 bg-white dark:bg-zinc-900 border-2 border-dashed border-blue-200 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center gap-2 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors"><Plus className="w-8 h-8" /><span className="font-medium">Log your first workout</span></button>
      )}

      <div>
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Personal Records</h3><span className="text-xs text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-full">{personalRecords.length} Exercises</span></div>
        <div className="grid grid-cols-2 gap-3">
          {personalRecords.length === 0 ? <div className="col-span-2 text-center py-8 text-gray-400 dark:text-zinc-600 bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800">No max weights yet.</div> : personalRecords.map((record, idx) => (
            <div key={idx} className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer">
              <div>
                <div className="text-xs text-gray-400 dark:text-zinc-500 font-medium uppercase tracking-wider truncate mb-1">{record.name}</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{record.kg} <span className="text-xs font-normal text-gray-400 dark:text-zinc-500">kg</span></div>
                {record.reps > 0 && <div className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">× {record.reps} reps</div>}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 dark:border-zinc-800 flex items-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500"><Calendar className="w-3 h-3" />{record.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkoutLogger({ user, workouts = [], onSave }) {
  const [workoutName, setWorkoutName] = useState(() => {
    try {
      const saved = localStorage.getItem(`ironlog_draft_${user.uid}`);
      return saved ? JSON.parse(saved).name : 'Evening Lift';
    } catch { return 'Evening Lift'; }
  });
  const [exercises, setExercises] = useState(() => {
    try {
      const saved = localStorage.getItem(`ironlog_draft_${user.uid}`);
      return saved ? JSON.parse(saved).exercises : [{ id: crypto.randomUUID(), name: 'Chest Press', notes: '', settings: { seat: '', incline: '' }, sets: [{ id: crypto.randomUUID(), kg: '', reps: '', completed: false }] }];
    } catch { return [{ id: crypto.randomUUID(), name: 'Chest Press', notes: '', settings: { seat: '', incline: '' }, sets: [{ id: crypto.randomUUID(), kg: '', reps: '', completed: false }] }]; }
  });

  useEffect(() => {
    const draftData = { name: workoutName, exercises };
    localStorage.setItem(`ironlog_draft_${user.uid}`, JSON.stringify(draftData));
  }, [workoutName, exercises, user.uid]);

  const [isSaving, setIsSaving] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const recentWorkouts = workouts.slice(0, 10).map(w => ({
        name: w.name,
        date: w.date.toLocaleDateString(),
        exercises: w.exercises.map(e => `${e.name} (${e.sets.length} sets)`).join(', ')
      }));
      const systemInstruction = `
        You are an expert fitness trainer. 
        USER HISTORY: ${JSON.stringify(recentWorkouts)}
        INSTRUCTIONS:
        1. Look at history. Suggest different muscle or recovery if needed.
        2. Apply progressive overload.
        3. Create workout for request: "${aiPrompt}"
        Return JSON: { "workoutName": "string", "exercises": [ { "name": "string", "notes": "string", "settings": { "seat": "", "incline": "" }, "sets": [ { "kg": number, "reps": number } ] } ] }
      `;
      const result = await callGemini(aiPrompt, systemInstruction);
      if (result && result.exercises) {
        setWorkoutName(result.workoutName || "AI Generated Workout");
        const processedExercises = result.exercises.map(ex => ({
          ...ex, id: crypto.randomUUID(), sets: ex.sets.map(s => ({ ...s, id: crypto.randomUUID(), completed: false }))
        }));
        setExercises(processedExercises);
        setShowAIModal(false);
        setAiPrompt('');
      }
    } catch (e) {
      alert("Failed to generate workout.");
    } finally {
      setIsGenerating(false);
    }
  };

  const addExercise = () => setExercises([...exercises, { id: crypto.randomUUID(), name: '', notes: '', settings: { seat: '', incline: '' }, sets: [{ id: crypto.randomUUID(), kg: '', reps: '', completed: false }] }]);
  const addSupersetExercise = (baseExerciseId, existingSupersetId) => {
    const newId = crypto.randomUUID();
    const supersetId = existingSupersetId || crypto.randomUUID();
    const newExercise = { 
      id: newId, supersetId: supersetId, name: '', notes: '', settings: { seat: '', incline: '' }, sets: [{ id: crypto.randomUUID(), kg: '', reps: '', completed: false }] 
    };
    const updatedExercises = exercises.reduce((acc, ex) => {
      if (ex.id === baseExerciseId) return [...acc, { ...ex, supersetId }, newExercise];
      return [...acc, ex];
    }, []);
    setExercises(updatedExercises);
  };
  const removeExercise = (id) => setExercises(exercises.filter(e => e.id !== id));
  const updateExercise = (id, field, value) => setExercises(exercises.map(e => e.id === id ? { ...e, [field]: value } : e));
  const updateSettings = (id, setting, value) => setExercises(exercises.map(e => e.id === id ? { ...e, settings: { ...e.settings, [setting]: value } } : e));
  const addSet = (exerciseId) => setExercises(exercises.map(e => e.id === exerciseId ? { ...e, sets: [...e.sets, { id: crypto.randomUUID(), kg: e.sets[e.sets.length - 1]?.kg || '', reps: e.sets[e.sets.length - 1]?.reps || '', completed: false }] } : e));
  const updateSet = (exerciseId, setId, field, value) => setExercises(exercises.map(e => e.id === exerciseId ? { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, [field]: value } : s) } : e));
  const removeSet = (exerciseId, setId) => setExercises(exercises.map(e => e.id === exerciseId ? { ...e, sets: e.sets.filter(s => s.id !== setId) } : e));

  const finishWorkout = async () => {
    if (exercises.length === 0) return;
    setIsSaving(true);
    try {
      const validExercises = exercises.filter(e => e.name.trim() !== '').map(e => ({
        name: e.name, notes: e.notes || '', settings: e.settings, supersetId: e.supersetId || null,
        sets: e.sets.map(s => ({ kg: Number(s.kg), reps: Number(s.reps) }))
      }));
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'workouts'), {
        name: workoutName, date: serverTimestamp(), exercises: validExercises,
        totalVolume: validExercises.reduce((acc, ex) => acc + ex.sets.reduce((sAcc, s) => sAcc + (s.kg * s.reps), 0), 0)
      });
      localStorage.removeItem(`ironlog_draft_${user.uid}`);
      setWorkoutName('Next Workout');
      setExercises([]);
      if(onSave) onSave(); 
    } catch (err) { alert("Failed to save."); } finally { setIsSaving(false); }
  };

  const exerciseGroups = groupExercises(exercises);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gradient-to-r from-violet-500 to-purple-600 text-white">
              <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Generator</h3>
              <button onClick={() => setShowAIModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 text-xs p-3 rounded-lg flex gap-2 items-start"><Activity className="w-4 h-4 mt-0.5 shrink-0" /><p>AI considers your last 10 workouts.</p></div>
              <textarea className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none h-24" placeholder="Goal (e.g. Chest & Triceps)" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
              <button onClick={handleAIGenerate} disabled={isGenerating || !aiPrompt.trim()} className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 flex justify-center items-center gap-2">{isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} {isGenerating ? "Designing..." : "Generate"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 space-y-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Session Name</label>
            <input value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} className="text-2xl font-bold text-gray-800 dark:text-white bg-transparent w-full focus:outline-none placeholder-gray-300" placeholder="e.g. Leg Day" />
          </div>
          <button onClick={() => setShowAIModal(true)} className="bg-gradient-to-br from-violet-500 to-purple-600 text-white p-2 rounded-xl shadow-lg shadow-purple-200 dark:shadow-none hover:scale-105 transition-transform"><Sparkles className="w-5 h-5" /></button>
        </div>
        <div className="text-sm text-gray-500 dark:text-zinc-500 flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      </div>

      <div className="space-y-4">
        {exerciseGroups.map((group, groupIndex) => {
          const isSuperset = group.length > 1;
          return (
            <div key={groupIndex} className={`relative animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-2xl ${isSuperset ? 'border-l-4 border-orange-500 bg-orange-50/30 dark:bg-orange-900/10 pl-2' : ''}`}>
               {isSuperset && <div className="absolute -left-4 top-4 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-r-md shadow-sm flex items-center gap-1 z-10"><Link className="w-3 h-3" /> Superset</div>}
               <div className={`space-y-4 ${isSuperset ? 'py-2' : ''}`}>
                 {group.map((exercise, indexInGroup) => (
                    <div key={exercise.id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden relative">
                      <div className="absolute top-4 right-4 flex gap-2">
                         {(!isSuperset && indexInGroup === 0) && <button onClick={() => addSupersetExercise(exercise.id, exercise.supersetId)} className="text-gray-300 dark:text-zinc-600 hover:text-orange-500 transition-colors p-1 rounded hover:bg-orange-50 dark:hover:bg-orange-900/30"><Link className="w-5 h-5" /></button>}
                         <button onClick={() => removeExercise(exercise.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30"><Trash2 className="w-5 h-5" /></button>
                      </div>
                      <div className="p-5 pb-2">
                        <input placeholder="Exercise Name" value={exercise.name} onChange={(e) => updateExercise(exercise.id, 'name', e.target.value)} className="text-lg font-bold text-gray-900 dark:text-white bg-transparent w-full pr-20 focus:outline-none border-b border-transparent focus:border-blue-200 placeholder-gray-300 dark:placeholder-zinc-600 transition-all" />
                        <div className="mt-2 flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2 border border-transparent focus-within:border-blue-300 focus-within:bg-transparent transition-all">
                          <MessageSquareQuote className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
                          <input placeholder="Exercise notes..." value={exercise.notes || ''} onChange={(e) => updateExercise(exercise.id, 'notes', e.target.value)} className="bg-transparent text-sm w-full focus:outline-none text-gray-600 dark:text-zinc-300 placeholder-gray-400 dark:placeholder-zinc-600" />
                        </div>
                        <div className="mt-3 flex gap-3">
                          <div className="flex-1 bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2 flex items-center gap-2 border border-transparent focus-within:border-blue-300 focus-within:bg-transparent transition-all"><Settings2 className="w-4 h-4 text-gray-400 dark:text-zinc-500" /><input placeholder="Seat Height" value={exercise.settings.seat} onChange={(e) => updateSettings(exercise.id, 'seat', e.target.value)} className="bg-transparent text-sm w-full focus:outline-none text-gray-600 dark:text-zinc-300" /></div>
                          <div className="flex-1 bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2 flex items-center gap-2 border border-transparent focus-within:border-blue-300 focus-within:bg-transparent transition-all"><TrendingUp className="w-4 h-4 text-gray-400 dark:text-zinc-500" /><input placeholder="Incline" value={exercise.settings.incline} onChange={(e) => updateSettings(exercise.id, 'incline', e.target.value)} className="bg-transparent text-sm w-full focus:outline-none text-gray-600 dark:text-zinc-300" /></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-10 gap-2 px-4 py-2 bg-gray-50/50 dark:bg-zinc-800/50 text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider text-center border-y border-gray-100 dark:border-zinc-800">
                        <div className="col-span-1">#</div><div className="col-span-3">kg</div><div className="col-span-3">Reps</div><div className="col-span-3">Done</div>
                      </div>
                      <div className="px-4 py-2 space-y-2">
                        {exercise.sets.map((set, index) => (
                          <div key={set.id} className={`grid grid-cols-10 gap-2 items-center group ${set.completed ? 'opacity-50' : 'opacity-100'} transition-opacity`}>
                            <div className="col-span-1 text-center font-medium text-gray-400 dark:text-zinc-600 text-sm">{index + 1}</div>
                            <div className="col-span-3"><input type="number" placeholder="-" value={set.kg} onChange={(e) => updateSet(exercise.id, set.id, 'kg', e.target.value)} disabled={set.completed} className="w-full text-center bg-gray-50 dark:bg-zinc-800 rounded-lg py-2 font-bold text-gray-700 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50" /></div>
                            <div className="col-span-3"><input type="number" placeholder="-" value={set.reps} onChange={(e) => updateSet(exercise.id, set.id, 'reps', e.target.value)} disabled={set.completed} className="w-full text-center bg-gray-50 dark:bg-zinc-800 rounded-lg py-2 font-bold text-gray-700 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50" /></div>
                            <div className="col-span-3 flex justify-center gap-2">
                              <button onClick={() => updateSet(exercise.id, set.id, 'completed', !set.completed)} className={`p-2 rounded-full transition-all ${set.completed ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 hover:bg-gray-200 dark:hover:bg-zinc-700'}`}>{set.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}</button>
                              {exercise.sets.length > 1 && <button onClick={() => removeSet(exercise.id, set.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => addSet(exercise.id)} className="w-full py-3 bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800 text-blue-600 dark:text-blue-400 font-medium text-sm flex items-center justify-center gap-2 transition-colors border-t border-gray-100 dark:border-zinc-800"><Plus className="w-4 h-4" /> Add Set</button>
                    </div>
                 ))}
                 {isSuperset && <button onClick={() => addSupersetExercise(group[group.length-1].id, group[group.length-1].supersetId)} className="w-full py-3 rounded-xl border-2 border-dashed border-orange-200 dark:border-orange-900/50 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center justify-center gap-2 font-medium transition-colors"><Plus className="w-4 h-4" /> Add to Superset</button>}
               </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 pt-4">
        <button onClick={addExercise} className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg shadow-lg hover:bg-blue-700 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Add Exercise</button>
        <button onClick={finishWorkout} disabled={isSaving} className="w-full py-4 rounded-xl bg-red-600 text-white font-bold text-lg shadow-lg hover:bg-red-700 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 disabled:opacity-70">{isSaving ? 'Saving...' : <><Save className="w-5 h-5" /> Finish Workout</>}</button>
      </div>
    </div>
  );
}

function WorkoutHistory({ user, workouts, onRepeat }) {
  const [expandedId, setExpandedId] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const deleteWorkout = async (e, id) => {
    e.stopPropagation();
    if(window.confirm("Delete this workout log?")) {
      try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'workouts', id)); } catch (e) { console.error("Error deleting", e); }
    }
  }
  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);
  const handleExport = () => {
    const dataStr = JSON.stringify(workouts, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `ironlog_backup.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    try {
      const historyContext = workouts.slice(0, 20).map(w => ({
        date: w.date.toLocaleDateString(), title: w.name, volume: w.totalVolume,
        exercises: w.exercises?.map(e => `${e.name} (Max ${Math.max(...(e.sets || []).map(s => Number(s.kg)||0))}kg)`).join(', ')
      }));
      const prompt = `Analyze user's last 20 workouts: ${JSON.stringify(historyContext)}. Output JSON { "analysis": "string" } with a short, specific critique and advice.`;
      const data = await callGemini(prompt);
      if (data && data.analysis) setAiSummary(data.analysis);
    } catch (e) { alert("Analysis failed."); } finally { setIsSummarizing(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Workout History</h3>
        <div className="flex items-center gap-3">
          {workouts.length > 0 && <button onClick={handleExport} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg transition-all"><Download className="w-5 h-5" /></button>}
          <span className="text-xs text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-full">{workouts.length} sessions</span>
        </div>
      </div>

      {workouts.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={100} /></div>
           <div className="relative z-10">
             <div className="flex justify-between items-start mb-2"><h4 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-yellow-300" /> Progress Report</h4></div>
             {isSummarizing ? <div className="flex items-center gap-2 text-indigo-100 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</div> : aiSummary ? <div className="animate-in fade-in"><p className="text-sm leading-relaxed text-indigo-50 font-medium">{aiSummary}</p><button onClick={() => setAiSummary(null)} className="mt-3 text-xs text-indigo-200 hover:text-white flex items-center gap-1 hover:underline">Close</button></div> : <button onClick={handleGenerateSummary} className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs font-bold py-2 px-3 rounded-lg transition-all flex items-center gap-2"><Zap className="w-3 h-3" /> Analyze History</button>}
           </div>
        </div>
      )}

      {workouts.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-zinc-600 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800"><Dumbbell className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>No workouts logged yet.</p></div>
      ) : (
        workouts.map((workout) => {
          const previewExercises = workout.exercises ? groupExercises(workout.exercises) : [];
          return (
          <div key={workout.id} onClick={() => toggleExpand(workout.id)} className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 hover:shadow-md transition-all cursor-pointer overflow-hidden ${expandedId === workout.id ? 'ring-2 ring-blue-100 dark:ring-blue-900' : ''}`}>
            <div className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div><h4 className="font-bold text-gray-900 dark:text-white text-lg">{workout.name}</h4><div className="text-sm text-gray-500 dark:text-zinc-500 flex items-center gap-1"><Calendar className="w-3 h-3" />{workout.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}<span className="mx-1">•</span>{workout.exercises?.length || 0} Exercises</div></div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); onRepeat(workout); }} className="text-gray-300 dark:text-zinc-600 hover:text-blue-500 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"><Repeat className="w-4 h-4" /></button>
                  <button onClick={(e) => deleteWorkout(e, workout.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"><Trash2 className="w-4 h-4" /></button>
                  <div className="text-gray-300 dark:text-zinc-600">{expandedId === workout.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</div>
                </div>
              </div>
              {expandedId !== workout.id && <div className="space-y-2">{previewExercises.slice(0, 3).map((group, i) => (<div key={i} className="flex justify-between items-center text-sm"><span className="font-medium text-gray-700 dark:text-zinc-300">{group[0].name} {group.length>1 && '(+Superset)'}</span><span className="text-gray-400 dark:text-zinc-500 text-xs">{group[0].sets?.length} sets</span></div>))}</div>}
            </div>
            {expandedId === workout.id && (
              <div className="bg-gray-50/50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 p-5 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-6">
                  {previewExercises.map((group, groupIndex) => (
                    <div key={groupIndex} className={`rounded-xl ${group.length > 1 ? 'border-l-4 border-orange-400 pl-3 py-1' : ''}`}>
                      <div className="space-y-4">
                        {group.map((ex, i) => (
                          <div key={i} className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-gray-100 dark:border-zinc-800 shadow-sm">
                            <div className="flex justify-between items-start mb-3 border-b border-gray-50 dark:border-zinc-800 pb-2">
                              <div><h5 className="font-bold text-gray-800 dark:text-white">{ex.name}</h5>{ex.notes && <p className="text-xs text-gray-500 dark:text-zinc-400 italic mt-1">"{ex.notes}"</p>}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">{ex.sets?.map((set, idx) => (<div key={idx} className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center border border-gray-100 dark:border-zinc-800"><div className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase font-bold mb-1">Set {idx + 1}</div><div className="font-mono font-medium text-gray-800 dark:text-zinc-200 text-sm"><span className="font-bold text-base">{set.kg}</span>kg × {set.reps}</div></div>))}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )})
      )}
    </div>
  );
}