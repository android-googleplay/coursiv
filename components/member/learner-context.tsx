"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import {
  defaultLearnerState, isCourseLessonProgressStorageKey, learnerStateStorageKey, lessonStartedStorageKey, LEARNER_STATE_STORAGE_KEY, localDateKey, mergeLearnerState, resetLessonProgress,
  type AiConversation, type LearnerPreferences, type LearnerState,
} from "@/lib/learner-state";
import { COURSE_PROGRESS_STORAGE_KEY, LESSON_ID, LESSON_STORAGE_KEY, lessonStorageKey } from "@/lib/lesson-data";
import { gradeProgramAssessment } from "@/lib/program-assessment";
import { practiceGames } from "@/lib/member-data";
import { ButtonLanguageProvider, type ButtonLanguage } from "./button-text";

type LearnerContextValue = {
  state: LearnerState;
  ready: boolean;
  saveScreen: (courseId: string, lessonId: string, screenId: string, response?: {outcome:"answered";blockId:string;values:string[]}|{outcome:"skipped"}) => Promise<void>;
  getLessonProgress: (courseId:string,lessonId:string)=>Promise<{visitedScreenIds:string[];resolvedScreenIds:string[];skippedScreenIds:string[];lastScreenId:string|null;completedAt:string|null}>;
  completeLesson: (courseId: string, lessonId: string) => Promise<void>;
  resetLesson: (courseId: string, lessonId: string) => Promise<void>;
  resetCourse: (courseId: string) => Promise<void>;
  updatePreference: <K extends keyof LearnerPreferences>(key: K, value: LearnerPreferences[K]) => Promise<void>;
  joinChallenge: (challengeId: string) => Promise<void>;
  completeChallengeDay: (challengeId: string, day: number, totalDays: number) => Promise<void>;
  completeGame: (gameId: string, questionId:string, answerIndex:number) => Promise<boolean>;
  submitProgramAssessment: (programId: string, answers: number[]) => Promise<{ score: number; bestScore: number; passed: boolean; passedAt: string | null }>;
  saveConversation: (conversation: AiConversation) => void;
  clearConversations: () => void;
};

const LearnerContext = createContext<LearnerContextValue | null>(null);

function readLocalState(storageKey=LEARNER_STATE_STORAGE_KEY) {
  if (typeof window === "undefined") return defaultLearnerState();
  try {
    const current = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Partial<LearnerState> | null;
    const merged = mergeLearnerState(current);
    if (!current) {
      const legacy = JSON.parse(localStorage.getItem(COURSE_PROGRESS_STORAGE_KEY) ?? "{}") as { completedLessonIds?: string[] };
      if (legacy.completedLessonIds?.length) merged.courses.chatgpt = { completedLessonIds: legacy.completedLessonIds, lastLessonId: legacy.completedLessonIds.at(-1) ?? null, lastScreenId: null, updatedAt: new Date().toISOString() };
    }
    return merged;
  } catch { return defaultLearnerState(); }
}

export function LearnerProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const getAuthToken = auth.getToken;
  const authUser = auth.user;
  const [state, setState] = useState<LearnerState>(()=>readLocalState());
  const [ready, setReady] = useState(false);
  const hydratedUser = useRef<string | null>(null);
  const preferenceQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    document.documentElement.dataset.memberTheme = state.preferences.darkMode ? "dark" : "light";
  }, [state.preferences.darkMode]);

  useEffect(() => {
    document.documentElement.lang = state.preferences.language === "繁體中文" ? "zh-Hant" : "en";
  }, [state.preferences.language]);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) {
      hydratedUser.current = null;
      queueMicrotask(() => { setState(defaultLearnerState()); setReady(true); });
      return;
    }
    const user = auth.user;
    if (hydratedUser.current === user.id) return;
    hydratedUser.current = user.id;
    setReady(false);
    const load = async () => {
      const scopedKey = learnerStateStorageKey(user.id);
      const scoped = localStorage.getItem(scopedKey);
      const legacy = localStorage.getItem(LEARNER_STATE_STORAGE_KEY);
      const local = scoped ? readLocalState(scopedKey) : legacy ? readLocalState() : defaultLearnerState();
      localStorage.setItem(scopedKey, JSON.stringify(local));
      localStorage.removeItem(LEARNER_STATE_STORAGE_KEY);
      if (user.demo) { setState(local); setReady(true); return; }
      try {
        const token=await getAuthToken();if(!token)throw new Error("Authentication required");
        const response=await fetch("/api/learner-state",{headers:{Authorization:`Bearer ${token}`}});const data=await response.json();if(!response.ok)throw new Error(data.error??"Unable to load learner state");
        let remote=mergeLearnerState(data.state as Partial<LearnerState>);
        if(!data.exists){const migration=await fetch("/api/learner-state",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({state:local})});const migrated=await migration.json();if(!migration.ok)throw new Error(migrated.error??"Unable to migrate learner state");remote=mergeLearnerState(migrated.state as Partial<LearnerState>);}
        setState(remote);
        localStorage.setItem(scopedKey, JSON.stringify(remote));
      } catch { setState(local); }
      setReady(true);
    };
    void load();
  }, [auth.loading, auth.user, getAuthToken]);

  const syncCertificates = useCallback(async () => {
    if (!authUser || authUser.demo) return;
    const token = await getAuthToken();
    if (!token) return;
    await fetch("/api/certificates/issue", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  }, [authUser, getAuthToken]);

  const postLearning = useCallback(async <T,>(path: string, body: Record<string, unknown>): Promise<T> => {
    if (!authUser || authUser.demo) return {} as T;
    const token = await getAuthToken();
    if (!token) throw new Error("Sign in again to save learning progress.");
    const response = await fetch(path, { method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(body) });
    const data = await response.json().catch(() => null) as ({ error?: string } & T) | null;
    if (!response.ok) throw new Error(data?.error ?? `Unable to save learning progress (${response.status})`);
    if (!data) throw new Error("Learning progress returned an empty response.");
    return data as T;
  }, [authUser, getAuthToken]);

  const commit = useCallback((recipe: (current: LearnerState) => LearnerState, options?: { syncCertificates?: boolean; persistRemote?:boolean }) => {
    setState((current) => {
      const next = recipe(current);
      const storageKey = auth.user ? learnerStateStorageKey(auth.user.id) : LEARNER_STATE_STORAGE_KEY;
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
    if(options?.syncCertificates&&options.persistRemote===false)void syncCertificates().catch(()=>undefined);
  }, [auth.user, syncCertificates]);

  const markToday = useCallback((current: LearnerState) => {
    const today = localDateKey(new Date(), current.preferences.timezone);
    return current.activityDates.includes(today) ? current.activityDates : [...current.activityDates, today].sort();
  }, []);

  const saveScreen = useCallback(async (courseId: string, lessonId: string, screenId: string, response?: {outcome:"answered";blockId:string;values:string[]}|{outcome:"skipped"}) => {
    await postLearning("/api/learning/progress", { action:"screen",courseId,lessonId,screenId,...(response?{response}:{}) });
    commit((current) => ({
      ...current,
      courses: { ...current.courses, [courseId]: { completedLessonIds: current.courses[courseId]?.completedLessonIds ?? [], lastLessonId: lessonId, lastScreenId: screenId, updatedAt: new Date().toISOString() } },
    }),{persistRemote:false});
  }, [commit, postLearning]);

  const getLessonProgress=useCallback(async(courseId:string,lessonId:string)=>{
    const empty={visitedScreenIds:[] as string[],resolvedScreenIds:[] as string[],skippedScreenIds:[] as string[],lastScreenId:null as string|null,completedAt:null as string|null};
    if(!authUser||authUser.demo)return empty;
    const token=await getAuthToken();if(!token)throw new Error("Sign in again to load lesson progress.");
    const response=await fetch(`/api/learning/progress?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`,{headers:{Authorization:`Bearer ${token}`}});const data=await response.json();if(!response.ok)throw new Error(data.error??"Unable to load lesson progress");
    return {visitedScreenIds:Array.isArray(data.visitedScreenIds)?data.visitedScreenIds:[],resolvedScreenIds:Array.isArray(data.resolvedScreenIds)?data.resolvedScreenIds:[],skippedScreenIds:Array.isArray(data.skippedScreenIds)?data.skippedScreenIds:[],lastScreenId:typeof data.lastScreenId==="string"?data.lastScreenId:null,completedAt:typeof data.completedAt==="string"?data.completedAt:null};
  },[authUser,getAuthToken]);

  const completeLesson = useCallback(async (courseId: string, lessonId: string) => {
    await postLearning("/api/learning/progress", { action:"complete",courseId,lessonId });
    commit((current) => {
    const existing = current.courses[courseId]?.completedLessonIds ?? [];
    return { ...current, activityDates: markToday(current), courses: { ...current.courses, [courseId]: { completedLessonIds: existing.includes(lessonId) ? existing : [...existing, lessonId], lastLessonId: lessonId, lastScreenId: null, updatedAt: new Date().toISOString() } } };
    }, { syncCertificates: true,persistRemote:false });
  }, [commit, markToday, postLearning]);
  const resetLesson = useCallback(async (courseId: string, lessonId: string) => {
    if (auth.user && !auth.user.demo) {
      const token=await auth.getToken();if(!token)throw new Error("Sign in again to reset this lesson.");
      const response=await fetch(`/api/learning/progress?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});const data=await response.json();if(!response.ok)throw new Error(data.error??"Unable to reset this lesson");
    }
    localStorage.removeItem(`coursiv.resolved.v3:${courseId}:${lessonId}`);
    localStorage.removeItem(`coursiv.skipped.v3:${courseId}:${lessonId}`);
    localStorage.removeItem(lessonStartedStorageKey(courseId,lessonId));
    if(courseId==="chatgpt"&&lessonId===LESSON_ID){localStorage.removeItem(LESSON_STORAGE_KEY);if(auth.user)localStorage.removeItem(lessonStorageKey(auth.user.id));}
    commit((current)=>resetLessonProgress(current,courseId,lessonId),{persistRemote:auth.user?.demo!==false});
  },[auth,commit]);
  const resetCourse = useCallback(async (courseId: string) => {
    if (auth.user && !auth.user.demo) {
      const token=await auth.getToken();if(!token)throw new Error("Sign in again to reset this course.");
      const response=await fetch(`/api/learning/progress?courseId=${encodeURIComponent(courseId)}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});const data=await response.json();if(!response.ok)throw new Error(data.error??"Unable to reset this course");
    }
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key && isCourseLessonProgressStorageKey(key, courseId)) localStorage.removeItem(key);
    }
    commit((current) => {
    const courses = { ...current.courses };
    delete courses[courseId];
    return { ...current, courses };
    },{persistRemote:auth.user?.demo!==false});
  }, [auth, commit]);

  const updatePreference = useCallback(async <K extends keyof LearnerPreferences>(key: K, value: LearnerPreferences[K]) => {
    commit((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } }),{persistRemote:false});
    if(!auth.user||auth.user.demo)return;
    preferenceQueue.current=preferenceQueue.current.catch(()=>undefined).then(async()=>{const token=await auth.getToken();if(!token)throw new Error("Sign in again to save preferences.");const response=await fetch("/api/learner-state",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({key,value})});const data=await response.json();if(!response.ok)throw new Error(data.error??"Unable to save preference");});
    await preferenceQueue.current;
  }, [auth,commit]);
  const joinChallenge = useCallback(async(challengeId: string) => {if(auth.user&&!auth.user.demo)await postLearning("/api/engagement/challenge",{action:"join",challengeId});commit((current) => current.challenges[challengeId] ? current : ({ ...current, challenges: { ...current.challenges, [challengeId]: { joinedAt: new Date().toISOString(), completedDays: [], completedDayDates: {}, completedAt: null } } }),{persistRemote:auth.user?.demo!==false});}, [auth.user,commit,postLearning]);
  const completeChallengeDay = useCallback(async(challengeId: string, day: number, totalDays: number) => {if(auth.user&&!auth.user.demo)await postLearning("/api/engagement/challenge",{action:"complete",challengeId,day});commit((current) => {
    const entry = current.challenges[challengeId] ?? { joinedAt: new Date().toISOString(), completedDays: [], completedDayDates: {}, completedAt: null };
    const today = localDateKey(new Date(), current.preferences.timezone);
    if (!entry.completedDays.includes(day) && Object.values(entry.completedDayDates ?? {}).includes(today)) return current;
    const completedDays = entry.completedDays.includes(day) ? entry.completedDays : [...entry.completedDays, day].sort((a, b) => a - b);
    return { ...current, activityDates: markToday(current), challenges: { ...current.challenges, [challengeId]: { ...entry, completedDays, completedDayDates: { ...(entry.completedDayDates ?? {}), [String(day)]: today }, completedAt: completedDays.length >= totalDays ? new Date().toISOString() : null } } };
  },{persistRemote:auth.user?.demo!==false});}, [auth.user,commit, markToday,postLearning]);
  const completeGame = useCallback(async(gameId:string,questionId:string,answerIndex:number)=>{const game=practiceGames.find((item)=>item.id===gameId);const question=game?.questions.find((item)=>item.id===questionId);if(!question)return false;const correct=answerIndex===question.correct;if(auth.user&&!auth.user.demo){const result=await postLearning<{correct:boolean}>("/api/engagement/game",{gameId,questionId,answerIndex});if(!result.correct)return false;}if(correct){const completionId=`${gameId}:${questionId}`;commit((current)=>current.completedGameIds.includes(completionId)?current:({...current,activityDates:markToday(current),gamePoints:current.gamePoints+25,completedGameIds:[...current.completedGameIds,completionId]}),{persistRemote:auth.user?.demo!==false});}return correct;},[auth.user,commit,markToday,postLearning]);
  const submitProgramAssessment = useCallback(async (programId: string, answers: number[]) => {
    const localGrade = gradeProgramAssessment(answers);
    if (!localGrade) throw new Error("Invalid assessment submission");
    const result = auth.user?.demo
      ? { ...localGrade,bestScore:localGrade.score,passedAt:localGrade.passed?new Date().toISOString():null }
      : await postLearning<{ score:number;bestScore:number;passed:boolean;passedAt:string|null }>("/api/learning/assessment", { programId,answers });
    commit((current) => ({
      ...current,
      activityDates: result.passed ? markToday(current) : current.activityDates,
      programAssessments: { ...current.programAssessments, [programId]: { score:result.bestScore, passedAt:result.passedAt } },
    }), { syncCertificates: result.passed,persistRemote:auth.user?.demo!==false });
    return result;
  }, [auth.user?.demo, commit, markToday, postLearning]);
  const saveConversation = useCallback((conversation: AiConversation) => commit((current) => ({ ...current, conversations: [conversation, ...current.conversations.filter((item) => item.id !== conversation.id)].slice(0, 30) })), [commit]);
  const clearConversations = useCallback(() => commit((current) => ({ ...current, conversations: [] })), [commit]);

  const value = useMemo(() => ({ state, ready, saveScreen, getLessonProgress, completeLesson, resetLesson, resetCourse, updatePreference, joinChallenge, completeChallengeDay, completeGame, submitProgramAssessment, saveConversation, clearConversations }), [clearConversations, completeChallengeDay, completeGame, completeLesson, getLessonProgress, joinChallenge, ready, resetCourse, resetLesson, saveConversation, saveScreen, state, submitProgramAssessment, updatePreference]);
  return <LearnerContext.Provider value={value}><ButtonLanguageProvider language={state.preferences.language as ButtonLanguage}>{children}</ButtonLanguageProvider></LearnerContext.Provider>;
}

export function useLearner() {
  const value = useContext(LearnerContext);
  if (!value) throw new Error("useLearner must be used inside LearnerProvider");
  return value;
}
