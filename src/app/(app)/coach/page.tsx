"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useToast } from "@/providers/ToastProvider";
import { appendCoachMessage, subscribeToCoachMessages } from "@/lib/firebase/repository";
import { callGemini } from "@/lib/ai/gemini-client";
import { COACH_SYSTEM_PROMPT } from "@/lib/ai/system-prompts";
import { computePRs } from "@/lib/analytics/personal-records";
import { Markdown } from "@/components/coach/Markdown";
import type { CoachMessage } from "@/types/ai";

export default function CoachPage() {
  const { user } = useAuth();
  const { workouts } = useWorkouts();
  const toast = useToast();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to persisted chat history
  useEffect(() => {
    if (!user) return;
    return subscribeToCoachMessages(user.uid, setMessages);
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = async (text?: string) => {
    if (!user) return;
    const message = (text ?? input).trim();
    if (!message) return;
    setInput("");
    await appendCoachMessage(user.uid, "user", message);
    setTyping(true);

    try {
      const recent = workouts.slice(0, 10).map((w) => ({
        date: w.date.toLocaleDateString(),
        name: w.name,
        volume: Math.round(w.totalVolume),
        exercises: w.exercises.map((e) => e.name).join(", "),
      }));
      const prs = computePRs(workouts).slice(0, 10);
      const history = [...messages.slice(-10), { role: "user", text: message }]
        .map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.text}`)
        .join("\n");

      const systemInstruction = `${COACH_SYSTEM_PROMPT}

USER DATA CONTEXT:
- Recent workouts: ${JSON.stringify(recent)}
- Personal records: ${JSON.stringify(prs)}

CONVERSATION (oldest → newest):
${history}`;

      const result = await callGemini<string>(message, systemInstruction);
      const text = typeof result === "string" ? result : JSON.stringify(result);
      await appendCoachMessage(user.uid, "model", text || "Hmm, no response — try again?");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "I can't reach the model right now.";
      toast.error(msg);
      await appendCoachMessage(user.uid, "model", "Sorry, I hit an error. Try again in a moment.");
    } finally {
      setTyping(false);
    }
  };

  const suggestions = [
    "What's my strongest lift?",
    "Suggest a leg session",
    "How's my push volume?",
    "Why might I be plateauing?",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] animate-fade-in -mt-4">
      <div className="bg-gradient-to-r from-brand-600 to-indigo-600 p-4 rounded-b-2xl shadow-lg -mx-4">
        <h2 className="text-white font-bold flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-200" /> AI Coach
        </h2>
        <p className="text-blue-100 text-xs">Personalized to your data. Chat history is saved.</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3 no-scrollbar">
        {messages.length === 0 && (
          <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">
            <Bot className="w-10 h-10 mx-auto opacity-30 mb-2" />
            <p>I have access to your {workouts.length} logged workouts.</p>
            <p>Ask about progress, programming, or technique.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-brand-600 text-white rounded-br-none whitespace-pre-wrap"
                  : "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-100 dark:border-zinc-700 rounded-bl-none shadow-sm"
              }`}
            >
              {m.role === "user" ? m.text : <Markdown text={m.text} />}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-zinc-800 p-3 rounded-2xl rounded-bl-none border border-zinc-100 dark:border-zinc-700 shadow-sm flex gap-1">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto pb-2">
        {messages.length < 2 && (
          <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="whitespace-nowrap bg-brand-50 dark:bg-zinc-800 text-brand-700 dark:text-brand-400 text-xs px-3 py-2 rounded-full border border-brand-100 dark:border-zinc-700 hover:bg-brand-100 dark:hover:bg-zinc-700 transition-colors min-h-[36px]"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-2 shadow-sm">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask your coach…"
            className="flex-1 bg-transparent px-2 py-2 text-sm outline-none text-zinc-800 dark:text-white placeholder-zinc-400"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || typing}
            aria-label="Send"
            className="p-2.5 min-w-[44px] min-h-[44px] bg-brand-600 rounded-lg text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
