import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, Save, History, Dumbbell, Calendar, Settings2, 
  TrendingUp, CheckCircle2, Circle, Activity, Home, Trophy, 
  Zap, Sparkles, Loader2, X, ChevronDown, ChevronUp, Repeat, 
  BarChart3, Layers, MessageSquareQuote, Moon, Sun, LogOut, Mail, Lock, User, AlertCircle
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
  doc
} from 'firebase/firestore';

// --- CONFIGURATION SECTION ---

// 1. API KEY: REMOVED
// We no longer need the API key here because the backend handles it!

// 2. FIREBASE CONFIG:
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ironlog-default';
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
  // UPDATED: Call our own Vercel Backend instead of Google directly
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
      
      // Parse the response from OUR backend
      const data = await response.json();

      if (!response.ok) {
        // If 404, it means the /api/gemini route is missing (e.g., running locally without 'vercel dev')
        if (response.status === 404) {
          throw new Error("Backend API not found. Please deploy to Vercel to use AI features.");
        }
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      // Extract the text from the Gemini response structure
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return JSON.parse(text);
    } catch (e) {
      console.error("AI Call Failed:", e);
      attempt++;
      if (attempt >= maxRetries) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// --- Chart Component ---
const MiniChart = ({ data, color = "#3b82f6", height = 60 }) => {
  if (!data || data.length < 2) return <div className="text-xs text-gray-400 dark:text-zinc-500 italic flex items-center justify-center h-full">Log more workouts to see trends</div>;
  
  const width = 300;
  const maxVal = Math.max(...data.map(d => d.val));
  const minVal = Math.min(...data.map(d => d.val));
  const range = maxVal - minVal || 1;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.val - minVal) / range) * (height - 10) - 5;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full h-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon fill="url(#gradient)" points={`0,${height} ${points} ${width},${height}`} />
        <polyline fill="none" stroke={color} strokeWidth="3" points={points} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={width} cy={height - ((data[data.length-1].val - minVal) / range) * (height - 10) - 5} r="4" fill={color} stroke="white" strokeWidth="2" />
      </svg>
    </div>
  );
};

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logTemplate, setLogTemplate] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  // 1. AUTHENTICATION
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

  // 2. DATABASE
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
    }, (error) => {
        console.error("History fetch error", error);
    });
    return () => unsubscribe();
  }, [user]);

  const handleRepeat = (workout) => {
    setLogTemplate(workout);
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
        {/* Header */}
        <nav className="bg-white dark:bg-zinc-900 shadow-sm dark:shadow-zinc-900 sticky top-0 z-10 px-4 py-3 flex justify-between items-center border-b border-transparent dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-blue-200 dark:shadow-none shadow-md">
              <Activity className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">IronLog</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="p-2 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </nav>

        <main className="max-w-md mx-auto p-4">
          {activeTab === 'home' && <Dashboard workouts={workouts} setActiveTab={setActiveTab} onRepeat={handleRepeat} user={user} />}
          {activeTab === 'log' && <WorkoutLogger user={user} workouts={workouts} initialData={logTemplate} onSave={() => { setLogTemplate(null); setActiveTab('home'); }} />}
          {activeTab === 'history' && <WorkoutHistory user={user} workouts={workouts} />}
        </main>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 px-6 py-2 flex justify-around items-center z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${activeTab === 'home' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-zinc-800' : 'text-gray-400 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}>
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-bold">Home</span>
          </button>
          <div className="relative -top-5">
            <button onClick={() => { setLogTemplate(null); setActiveTab('log'); }} className={`flex flex-col items-center justify-center w-14 h-14 rounded-full shadow-lg border-4 border-gray-50 dark:border-zinc-950 transition-all ${activeTab === 'log' ? 'bg-blue-600 text-white scale-110' : 'bg-blue-600 text-white hover:scale-105'}`}>
              <Plus className="w-7 h-7" />
            </button>
          </div>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${activeTab === 'history' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-zinc-800' : 'text-gray-400 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}>
            <History className="w-5 h-5" />
            <span className="text-[10px] font-bold">History</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- New Authentication Component ---

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
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      // Improved Error Handling
      console.log(err.code);
      let msg = err.message;
      if (msg.includes('operation-not-allowed')) {
        msg = "Authentication disabled. Enable 'Email/Password' in Firebase Console > Authentication.";
      } else if (msg.includes('email-already-in-use')) {
        msg = "Email already in use. Try signing in instead.";
      } else if (msg.includes('weak-password')) {
        msg = "Password is too weak (min 6 characters).";
      } else if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        msg = "Incorrect email or password.";
      }
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
            <button 
              onClick={() => { setIsLogin(true); setError(''); }} 
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-zinc-500'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => { setIsLogin(false); setError(''); }} 
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-zinc-500'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-wider ml-1">Email</label>
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800 px-4 py-3 rounded-xl border border-transparent focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-zinc-900 transition-all">
                <Mail className="w-5 h-5 text-gray-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" 
                  className="bg-transparent w-full outline-none text-gray-800 dark:text-white placeholder-gray-400"
                  required 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-wider ml-1">Password</label>
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800 px-4 py-3 rounded-xl border border-transparent focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-zinc-900 transition-all">
                <Lock className="w-5 h-5 text-gray-400" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="bg-transparent w-full outline-none text-gray-800 dark:text-white placeholder-gray-400"
                  required 
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> 
                <span>{error}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? "Sign In" : "Create Account")}
            </button>
          </form>
        </div>
        
        <div className="mt-8 flex justify-center">
           <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="p-3 rounded-full bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-500 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
        </div>
      </div>
    </div>
  );
}

// --- Sub-Components (Unchanged Logic, updated user prop usage) ---

function Dashboard({ workouts, setActiveTab, onRepeat, user }) {
  const [coachTip, setCoachTip] = useState(null);
  const [loadingTip, setLoadingTip] = useState(false);
  const [chartMetric, setChartMetric] = useState('volume');

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
                if (bestSetInSession.kg > currentRecord.kg || 
                   (bestSetInSession.kg === currentRecord.kg && bestSetInSession.reps > currentRecord.reps)) {
                    records[name] = { ...bestSetInSession, date: workout.date };
                }
            }
        }
      });
    });
    return Object.entries(records).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.kg - a.kg);
  }, [workouts]);

  const chartData = useMemo(() => {
    return workouts.slice().sort((a, b) => a.date - b.date).map(w => {
      if (chartMetric === 'volume') return { val: w.totalVolume || 0 };
      const totalSets = w.exercises?.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0) || 0;
      return { val: totalSets };
    }).slice(-7);
  }, [workouts, chartMetric]);

  const weeklyProgress = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0,0,0,0);
    return workouts.filter(w => w.date >= startOfWeek).length;
  }, [workouts]);

  const totalWorkouts = workouts.length;
  const latestWorkout = workouts[0];

  const getCoachInsight = async () => {
    setLoadingTip(true);
    try {
      const recentHistory = workouts.slice(0, 3).map(w => ({
        name: w.name,
        date: w.date.toDateString(),
        volume: w.totalVolume,
        exercises: w.exercises.map(e => e.name).join(', ')
      }));
      const prompt = `Analyze these recent workouts: ${JSON.stringify(recentHistory)}. Give me one short, specific, and motivating insight or tip (under 30 words) for my next session. Return valid JSON: { "tip": "string" }`;
      const result = await callGemini(prompt, "You are an elite fitness coach.");
      setCoachTip(result?.tip || "Keep pushing!");
    } catch (e) {
      console.error(e);
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
        <div className="bg-blue-50 dark:bg-zinc-900 text-blue-700 dark:text-blue-400 px-3 py-2 rounded-xl flex items-center gap-2 shadow-sm border border-blue-100 dark:border-zinc-800"><div className="relative"><Circle className="w-8 h-8 text-blue-200 dark:text-blue-900" strokeWidth={4} /><div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{weeklyProgress}</div></div><div className="flex flex-col leading-none"><span className="text-[10px] text-blue-400 font-bold uppercase">This Week</span><span className="text-xs font-bold">Sessions</span></div></div>
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
        <div className="flex justify-between items-start mb-4">
          <div><h2 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><Activity className="w-5 h-5 text-blue-500" /> {chartMetric === 'volume' ? 'Volume Load' : 'Training Frequency'}</h2><p className="text-gray-400 dark:text-zinc-500 text-xs">{chartMetric === 'volume' ? 'Total kg' : 'Total sets'} (Last 7)</p></div>
          <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
            <button onClick={() => setChartMetric('volume')} className={`p-1.5 rounded-md transition-all ${chartMetric === 'volume' ? 'bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-white' : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600'}`}><BarChart3 className="w-4 h-4" /></button>
            <button onClick={() => setChartMetric('sets')} className={`p-1.5 rounded-md transition-all ${chartMetric === 'sets' ? 'bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-white' : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600'}`}><Layers className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="h-32 w-full"><MiniChart data={chartData} height={80} color={chartMetric === 'volume' ? '#3b82f6' : '#8b5cf6'} /></div>
      </div>

      {latestWorkout && (
        <div className="grid grid-cols-1 gap-3">
           <button onClick={() => onRepeat(latestWorkout)} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm p-4 rounded-xl flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors group">
             <div className="flex items-center gap-3">
               <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg text-green-600 dark:text-green-400 group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors"><Repeat className="w-5 h-5" /></div>
               <div className="text-left"><div className="font-bold text-gray-900 dark:text-white text-sm">Repeat Last Workout</div><div className="text-xs text-gray-500 dark:text-zinc-500">Do "{latestWorkout.name}" again</div></div>
             </div>
             <ChevronDown className="w-4 h-4 text-gray-300 dark:text-zinc-600 -rotate-90" />
           </button>
        </div>
      )}

      {totalWorkouts === 0 && (
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

function WorkoutLogger({ user, workouts = [], initialData = null, onSave }) {
  const [workoutName, setWorkoutName] = useState('Evening Lift');
  const [exercises, setExercises] = useState([{ id: crypto.randomUUID(), name: 'Chest Press', notes: '', settings: { seat: '', incline: '' }, sets: [{ id: crypto.randomUUID(), kg: '', reps: '', completed: false }] }]);
  
  useEffect(() => {
    if (initialData) {
      setWorkoutName(initialData.name || 'Evening Lift');
      if (initialData.exercises && initialData.exercises.length > 0) {
        setExercises(initialData.exercises.map(ex => ({
          ...ex, id: crypto.randomUUID(), sets: ex.sets.map(s => ({ ...s, id: crypto.randomUUID(), completed: false }))
        })));
      }
    }
  }, [initialData]);

  const [isSaving, setIsSaving] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const recentWorkouts = workouts.slice(0, 5).map(w => ({
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
      console.error("AI Gen Error", e);
      alert("Failed to generate workout. Check API Key.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Exercise helper functions
  const addExercise = () => setExercises([...exercises, { id: crypto.randomUUID(), name: '', notes: '', settings: { seat: '', incline: '' }, sets: [{ id: crypto.randomUUID(), kg: '', reps: '', completed: false }] }]);
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
        name: e.name,
        notes: e.notes || '', 
        settings: e.settings,
        sets: e.sets.map(s => ({ kg: Number(s.kg), reps: Number(s.reps) }))
      }));
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'workouts'), {
        name: workoutName,
        date: serverTimestamp(),
        exercises: validExercises,
        totalVolume: validExercises.reduce((acc, ex) => acc + ex.sets.reduce((sAcc, s) => sAcc + (s.kg * s.reps), 0), 0)
      });
      setWorkoutName('Next Workout');
      setExercises([]);
      if(onSave) onSave(); 
    } catch (err) {
      console.error("Error saving", err);
      alert("Failed to save. Check Firebase Config.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gradient-to-r from-violet-500 to-purple-600 text-white">
              <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Generator</h3>
              <button onClick={() => setShowAIModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 text-xs p-3 rounded-lg flex gap-2 items-start"><Activity className="w-4 h-4 mt-0.5 shrink-0" /><p>AI considers your last 5 workouts.</p></div>
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
        {exercises.map((exercise, i) => (
          <div key={exercise.id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden relative animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button onClick={() => removeExercise(exercise.id)} className="absolute top-4 right-4 text-gray-300 dark:text-zinc-600 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
            <div className="p-5 pb-2">
              <input placeholder="Exercise Name" value={exercise.name} onChange={(e) => updateExercise(exercise.id, 'name', e.target.value)} className="text-lg font-bold text-gray-900 dark:text-white bg-transparent w-full pr-8 focus:outline-none border-b border-transparent focus:border-blue-200 placeholder-gray-300 dark:placeholder-zinc-600 transition-all" />
              
              {/* Note input per exercise */}
              <div className="mt-2 flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2 border border-transparent focus-within:border-blue-300 focus-within:bg-transparent transition-all">
                <MessageSquareQuote className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
                <input 
                  placeholder="Exercise notes (e.g. elbow pain, slow tempo)..." 
                  value={exercise.notes || ''} 
                  onChange={(e) => updateExercise(exercise.id, 'notes', e.target.value)} 
                  className="bg-transparent text-sm w-full focus:outline-none text-gray-600 dark:text-zinc-300 placeholder-gray-400 dark:placeholder-zinc-600" 
                />
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
                  <div className="col-span-3"><input type="number" placeholder="-" value={set.kg} onChange={(e) => updateSet(exercise.id, set.id, 'kg', e.target.value)} className="w-full text-center bg-gray-50 dark:bg-zinc-800 rounded-lg py-2 font-bold text-gray-700 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-700 outline-none transition-all" /></div>
                  <div className="col-span-3"><input type="number" placeholder="-" value={set.reps} onChange={(e) => updateSet(exercise.id, set.id, 'reps', e.target.value)} className="w-full text-center bg-gray-50 dark:bg-zinc-800 rounded-lg py-2 font-bold text-gray-700 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-700 outline-none transition-all" /></div>
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
      </div>
      <div className="flex flex-col gap-3 pt-4">
        <button onClick={addExercise} className="w-full py-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-all font-semibold flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Add Exercise</button>
        <button onClick={finishWorkout} disabled={isSaving} className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 hover:shadow-xl hover:scale-[1.01] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70">{isSaving ? 'Saving...' : <><Save className="w-5 h-5" /> Finish Workout</>}</button>
      </div>
    </div>
  );
}

function WorkoutHistory({ user, workouts }) {
  const [expandedId, setExpandedId] = useState(null);
  const deleteWorkout = async (e, id) => {
    e.stopPropagation();
    if(window.confirm("Delete this workout log?")) {
      // Use stableId here as well
      try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'workouts', id)); } catch (e) { console.error("Error deleting", e); }
    }
  }
  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-gray-900 dark:text-white">Workout History</h3><span className="text-xs text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-full">{workouts.length} sessions</span></div>
      {workouts.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-zinc-600 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800"><Dumbbell className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>No workouts logged yet.</p></div>
      ) : (
        workouts.map((workout) => (
          <div key={workout.id} onClick={() => toggleExpand(workout.id)} className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 hover:shadow-md transition-all cursor-pointer overflow-hidden ${expandedId === workout.id ? 'ring-2 ring-blue-100 dark:ring-blue-900' : ''}`}>
            <div className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div><h4 className="font-bold text-gray-900 dark:text-white text-lg">{workout.name}</h4><div className="text-sm text-gray-500 dark:text-zinc-500 flex items-center gap-1"><Calendar className="w-3 h-3" />{workout.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}<span className="mx-1">•</span>{workout.exercises?.length || 0} Exercises</div></div>
                <div className="flex items-center gap-2"><button onClick={(e) => deleteWorkout(e, workout.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"><Trash2 className="w-4 h-4" /></button><div className="text-gray-300 dark:text-zinc-600">{expandedId === workout.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</div></div>
              </div>
              {expandedId !== workout.id && (
                <div className="space-y-2">
                  {workout.exercises?.slice(0, 3).map((ex, i) => (
                    <div key={i} className="flex justify-between items-center text-sm"><span className="font-medium text-gray-700 dark:text-zinc-300">{ex.name}</span><span className="text-gray-400 dark:text-zinc-500 text-xs">{ex.sets?.length} sets • Max {Math.max(...(ex.sets || []).map(s => s.kg || 0))}kg</span></div>
                  ))}
                  {workout.exercises?.length > 3 && <div className="text-xs text-center text-blue-500 dark:text-blue-400 pt-1 font-medium">+ {workout.exercises.length - 3} more exercises</div>}
                </div>
              )}
            </div>
            {expandedId === workout.id && (
              <div className="bg-gray-50/50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 p-5 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-6">
                  {workout.exercises?.map((ex, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-gray-100 dark:border-zinc-800 shadow-sm">
                      <div className="flex justify-between items-start mb-3 border-b border-gray-50 dark:border-zinc-800 pb-2">
                        <div>
                            <h5 className="font-bold text-gray-800 dark:text-white">{ex.name}</h5>
                            {ex.notes && <p className="text-xs text-gray-500 dark:text-zinc-400 italic mt-1">"{ex.notes}"</p>}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-zinc-500 flex flex-col items-end gap-0.5">
                           {ex.settings?.seat && <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-gray-600 dark:text-zinc-400 flex items-center gap-1"><Settings2 className="w-3 h-3" /> Seat: {ex.settings.seat}</span>}
                           {ex.settings?.incline && <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-gray-600 dark:text-zinc-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Inc: {ex.settings.incline}</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">{ex.sets?.map((set, idx) => (<div key={idx} className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-center border border-gray-100 dark:border-zinc-800"><div className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase font-bold mb-1">Set {idx + 1}</div><div className="font-mono font-medium text-gray-800 dark:text-zinc-200 text-sm"><span className="font-bold text-base">{set.kg}</span>kg × {set.reps}</div></div>))}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}