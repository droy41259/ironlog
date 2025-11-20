import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, Save, History, Dumbbell, Calendar, Settings2, 
  TrendingUp, CheckCircle2, Circle, Activity, Home, Trophy, 
  Zap, Sparkles, Loader2, X, ChevronDown, ChevronUp, Repeat, BarChart3, Layers
} from 'lucide-react';

// npm install firebase
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
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

// TODO: Get your Gemini API Key from https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = "AIzaSyAZE5siicNIlFLbivoaxkXxbjqifiJGlF8";
 

// TODO: Get this from Firebase Console -> Project Settings -> General -> Your Apps -> SDK Setup
const firebaseConfig = {
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
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("YOUR_GEMINI")) {
    alert("Please set your Gemini API Key in the code.");
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: { responseMimeType: "application/json" }
  };

  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return JSON.parse(text);
    } catch (e) {
      attempt++;
      if (attempt >= maxRetries) throw e;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}

// --- Chart Component ---
const MiniChart = ({ data, color = "#3b82f6", height = 60 }) => {
  if (!data || data.length < 2) return <div className="text-xs text-gray-400 italic flex items-center justify-center h-full">Log more workouts to see trends</div>;
  
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

  useEffect(() => {
    // Simplified Auth for Production
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth failed", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    // Production path: users/{userId}/workouts
    const q = query(
      collection(db, 'users', user.uid, 'workouts'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date ? doc.data().date.toDate() : new Date()
      }));
      setWorkouts(data);
      setLoading(false);
    }, (error) => {
        console.error("History fetch error", error);
        setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleRepeat = (workout) => {
    setLogTemplate(workout);
    setActiveTab('log');
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-blue-500 font-medium animate-pulse">Loading IronLog...</div>;
  if (!user) return <div className="flex h-screen items-center justify-center">Please sign in.</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-24 font-sans select-none">
      <nav className="bg-white shadow-sm sticky top-0 z-10 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-blue-200 shadow-md">
            <Activity className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-gray-900">IronLog</span>
        </div>
      </nav>

      <main className="max-w-md mx-auto p-4">
        {activeTab === 'home' && <Dashboard workouts={workouts} setActiveTab={setActiveTab} onRepeat={handleRepeat} />}
        {activeTab === 'log' && <WorkoutLogger user={user} workouts={workouts} initialData={logTemplate} onSave={() => { setLogTemplate(null); setActiveTab('home'); }} />}
        {activeTab === 'history' && <WorkoutHistory user={user} workouts={workouts} />}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-2 flex justify-around items-center z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${activeTab === 'home' ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-50'}`}>
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <div className="relative -top-5">
          <button onClick={() => { setLogTemplate(null); setActiveTab('log'); }} className={`flex flex-col items-center justify-center w-14 h-14 rounded-full shadow-lg border-4 border-gray-50 transition-all ${activeTab === 'log' ? 'bg-blue-600 text-white scale-110' : 'bg-blue-600 text-white hover:scale-105'}`}>
            <Plus className="w-7 h-7" />
          </button>
        </div>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${activeTab === 'history' ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-50'}`}>
          <History className="w-5 h-5" />
          <span className="text-[10px] font-bold">History</span>
        </button>
      </div>
    </div>
  );
}

// --- Sub-Components ---

function Dashboard({ workouts, setActiveTab, onRepeat }) {
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
      setCoachTip(result.tip);
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
        <div><h1 className="text-2xl font-bold text-gray-900">Dashboard</h1><p className="text-gray-500 text-sm">{totalWorkouts > 0 ? "Keep up the momentum!" : "Ready to start?"}</p></div>
        <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-xl flex items-center gap-2 shadow-sm border border-blue-100"><div className="relative"><Circle className="w-8 h-8 text-blue-200" strokeWidth={4} /><div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{weeklyProgress}</div></div><div className="flex flex-col leading-none"><span className="text-[10px] text-blue-400 font-bold uppercase">This Week</span><span className="text-xs font-bold">Sessions</span></div></div>
      </div>

      <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-purple-200 relative overflow-hidden">
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

      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div><h2 className="font-bold text-gray-800 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-500" /> {chartMetric === 'volume' ? 'Volume Load' : 'Training Frequency'}</h2><p className="text-gray-400 text-xs">{chartMetric === 'volume' ? 'Total kg' : 'Total sets'} (Last 7)</p></div>
          <div className="flex bg-gray-100 p-1 rounded-lg"><button onClick={() => setChartMetric('volume')} className={`p-1.5 rounded-md transition-all ${chartMetric === 'volume' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}><BarChart3 className="w-4 h-4" /></button><button onClick={() => setChartMetric('sets')} className={`p-1.5 rounded-md transition-all ${chartMetric === 'sets' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}><Layers className="w-4 h-4" /></button></div>
        </div>
        <div className="h-32 w-full"><MiniChart data={chartData} height={80} color={chartMetric === 'volume' ? '#3b82f6' : '#8b5cf6'} /></div>
      </div>

      {latestWorkout && (
        <div className="grid grid-cols-1 gap-3">
           <button onClick={() => onRepeat(latestWorkout)} className="bg-white border border-gray-100 shadow-sm p-4 rounded-xl flex items-center justify-between hover:bg-gray-50 transition-colors group"><div className="flex items-center gap-3"><div className="bg-green-100 p-2 rounded-lg text-green-600 group-hover:bg-green-200 transition-colors"><Repeat className="w-5 h-5" /></div><div className="text-left"><div className="font-bold text-gray-900 text-sm">Repeat Last Workout</div><div className="text-xs text-gray-500">Do "{latestWorkout.name}" again</div></div></div><ChevronDown className="w-4 h-4 text-gray-300 -rotate-90" /></button>
        </div>
      )}

      {totalWorkouts === 0 && (
        <button onClick={() => setActiveTab('log')} className="w-full py-4 bg-white border-2 border-dashed border-blue-200 rounded-xl flex flex-col items-center justify-center gap-2 text-blue-500 hover:bg-blue-50 transition-colors"><Plus className="w-8 h-8" /><span className="font-medium">Log your first workout</span></button>
      )}

      <div>
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Personal Records</h3><span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{personalRecords.length} Exercises</span></div>
        <div className="grid grid-cols-2 gap-3">
          {personalRecords.length === 0 ? <div className="col-span-2 text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-100">No max weights yet.</div> : personalRecords.map((record, idx) => (
            <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer">
              <div>
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wider truncate mb-1">{record.name}</div>
                <div className="text-xl font-bold text-gray-900">{record.kg} <span className="text-xs font-normal text-gray-400">kg</span></div>
                {record.reps > 0 && <div className="text-xs text-gray-500 mt-0.5">× {record.reps} reps</div>}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-1 text-[10px] text-gray-400"><Calendar className="w-3 h-3" />{record.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkoutLogger({ user, workouts = [], initialData = null, onSave }) {
  const [workoutName, setWorkoutName] = useState('Evening Lift');
  const [exercises, setExercises] = useState([{ id: crypto.randomUUID(), name: 'Chest Press', settings: { seat: '', incline: '' }, sets: [{ id: crypto.randomUUID(), kg: '', reps: '', completed: false }] }]);
  
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
        Return JSON: { "workoutName": "string", "exercises": [ { "name": "string", "settings": { "seat": "", "incline": "" }, "sets": [ { "kg": number, "reps": number } ] } ] }
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
  const addExercise = () => setExercises([...exercises, { id: crypto.randomUUID(), name: '', settings: { seat: '', incline: '' }, sets: [{ id: crypto.randomUUID(), kg: '', reps: '', completed: false }] }]);
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
        settings: e.settings,
        sets: e.sets.map(s => ({ kg: Number(s.kg), reps: Number(s.reps) }))
      }));
      await addDoc(collection(db, 'users', user.uid, 'workouts'), {
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
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-violet-500 to-purple-600 text-white">
              <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Generator</h3>
              <button onClick={() => setShowAIModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 text-blue-600 text-xs p-3 rounded-lg flex gap-2 items-start"><Activity className="w-4 h-4 mt-0.5 shrink-0" /><p>AI considers your last 5 workouts.</p></div>
              <textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none h-24" placeholder="Goal (e.g. Chest & Triceps)" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
              <button onClick={handleAIGenerate} disabled={isGenerating || !aiPrompt.trim()} className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 flex justify-center items-center gap-2">{isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} {isGenerating ? "Designing..." : "Generate"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Session Name</label>
            <input value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} className="text-2xl font-bold text-gray-800 w-full focus:outline-none placeholder-gray-300" placeholder="e.g. Leg Day" />
          </div>
          <button onClick={() => setShowAIModal(true)} className="bg-gradient-to-br from-violet-500 to-purple-600 text-white p-2 rounded-xl shadow-lg shadow-purple-200 hover:scale-105 transition-transform"><Sparkles className="w-5 h-5" /></button>
        </div>
        <div className="text-sm text-gray-500 flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      </div>

      <div className="space-y-4">
        {exercises.map((exercise, i) => (
          <div key={exercise.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button onClick={() => removeExercise(exercise.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
            <div className="p-5 pb-2">
              <input placeholder="Exercise Name" value={exercise.name} onChange={(e) => updateExercise(exercise.id, 'name', e.target.value)} className="text-lg font-bold text-gray-900 w-full pr-8 focus:outline-none border-b border-transparent focus:border-blue-200 placeholder-gray-300 transition-all" />
              <div className="mt-3 flex gap-3">
                <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2 border border-transparent focus-within:border-blue-300 focus-within:bg-white transition-all"><Settings2 className="w-4 h-4 text-gray-400" /><input placeholder="Seat Height" value={exercise.settings.seat} onChange={(e) => updateSettings(exercise.id, 'seat', e.target.value)} className="bg-transparent text-sm w-full focus:outline-none text-gray-600" /></div>
                <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2 border border-transparent focus-within:border-blue-300 focus-within:bg-white transition-all"><TrendingUp className="w-4 h-4 text-gray-400" /><input placeholder="Incline" value={exercise.settings.incline} onChange={(e) => updateSettings(exercise.id, 'incline', e.target.value)} className="bg-transparent text-sm w-full focus:outline-none text-gray-600" /></div>
              </div>
            </div>
            <div className="grid grid-cols-10 gap-2 px-4 py-2 bg-gray-50/50 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center border-y border-gray-100">
              <div className="col-span-1">#</div><div className="col-span-3">kg</div><div className="col-span-3">Reps</div><div className="col-span-3">Done</div>
            </div>
            <div className="px-4 py-2 space-y-2">
              {exercise.sets.map((set, index) => (
                <div key={set.id} className={`grid grid-cols-10 gap-2 items-center group ${set.completed ? 'opacity-50' : 'opacity-100'} transition-opacity`}>
                  <div className="col-span-1 text-center font-medium text-gray-400 text-sm">{index + 1}</div>
                  <div className="col-span-3"><input type="number" placeholder="-" value={set.kg} onChange={(e) => updateSet(exercise.id, set.id, 'kg', e.target.value)} className="w-full text-center bg-gray-50 rounded-lg py-2 font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" /></div>
                  <div className="col-span-3"><input type="number" placeholder="-" value={set.reps} onChange={(e) => updateSet(exercise.id, set.id, 'reps', e.target.value)} className="w-full text-center bg-gray-50 rounded-lg py-2 font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" /></div>
                  <div className="col-span-3 flex justify-center gap-2">
                    <button onClick={() => updateSet(exercise.id, set.id, 'completed', !set.completed)} className={`p-2 rounded-full transition-all ${set.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{set.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}</button>
                    {exercise.sets.length > 1 && <button onClick={() => removeSet(exercise.id, set.id)} className="text-gray-300 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => addSet(exercise.id)} className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-blue-600 font-medium text-sm flex items-center justify-center gap-2 transition-colors border-t border-gray-100"><Plus className="w-4 h-4" /> Add Set</button>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 pt-4">
        <button onClick={addExercise} className="w-full py-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all font-semibold flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Add Exercise</button>
        <button onClick={finishWorkout} disabled={isSaving} className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl hover:scale-[1.01] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70">{isSaving ? 'Saving...' : <><Save className="w-5 h-5" /> Finish Workout</>}</button>
      </div>
    </div>
  );
}

function WorkoutHistory({ user, workouts }) {
  const [expandedId, setExpandedId] = useState(null);
  const deleteWorkout = async (e, id) => {
    e.stopPropagation();
    if(window.confirm("Delete this workout log?")) {
      try { await deleteDoc(doc(db, 'users', user.uid, 'workouts', id)); } catch (e) { console.error("Error deleting", e); }
    }
  }
  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-gray-900">Workout History</h3><span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{workouts.length} sessions</span></div>
      {workouts.length === 0 ? (
        <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200"><Dumbbell className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>No workouts logged yet.</p></div>
      ) : (
        workouts.map((workout) => (
          <div key={workout.id} onClick={() => toggleExpand(workout.id)} className={`bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer overflow-hidden ${expandedId === workout.id ? 'ring-2 ring-blue-100' : ''}`}>
            <div className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div><h4 className="font-bold text-gray-900 text-lg">{workout.name}</h4><div className="text-sm text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" />{workout.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}<span className="mx-1">•</span>{workout.exercises?.length || 0} Exercises</div></div>
                <div className="flex items-center gap-2"><button onClick={(e) => deleteWorkout(e, workout.id)} className="text-gray-300 hover:text-red-400 p-2 hover:bg-red-50 rounded-full transition-colors"><Trash2 className="w-4 h-4" /></button><div className="text-gray-300">{expandedId === workout.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</div></div>
              </div>
              {expandedId !== workout.id && (
                <div className="space-y-2">
                  {workout.exercises?.slice(0, 3).map((ex, i) => (
                    <div key={i} className="flex justify-between items-center text-sm"><span className="font-medium text-gray-700">{ex.name}</span><span className="text-gray-400 text-xs">{ex.sets?.length} sets • Max {Math.max(...(ex.sets || []).map(s => s.kg || 0))}kg</span></div>
                  ))}
                  {workout.exercises?.length > 3 && <div className="text-xs text-center text-blue-500 pt-1 font-medium">+ {workout.exercises.length - 3} more exercises</div>}
                </div>
              )}
            </div>
            {expandedId === workout.id && (
              <div className="bg-gray-50/50 border-t border-gray-100 p-5 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-6">
                  {workout.exercises?.map((ex, i) => (
                    <div key={i} className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                      <div className="flex justify-between items-start mb-3 border-b border-gray-50 pb-2">
                        <h5 className="font-bold text-gray-800">{ex.name}</h5>
                        <div className="text-xs text-gray-500 flex flex-col items-end gap-0.5">
                           {ex.settings?.seat && <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 flex items-center gap-1"><Settings2 className="w-3 h-3" /> Seat: {ex.settings.seat}</span>}
                           {ex.settings?.incline && <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Inc: {ex.settings.incline}</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">{ex.sets?.map((set, idx) => (<div key={idx} className="bg-gray-50 p-2 rounded text-center border border-gray-100"><div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Set {idx + 1}</div><div className="font-mono font-medium text-gray-800 text-sm"><span className="font-bold text-base">{set.kg}</span>kg × {set.reps}</div></div>))}</div>
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
