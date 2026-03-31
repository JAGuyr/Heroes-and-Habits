/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sword, 
  Shield, 
  Star, 
  Trophy, 
  Coins, 
  Flame, 
  CheckCircle2, 
  Plus, 
  ShoppingBag, 
  LayoutDashboard,
  Droplets,
  Sparkles,
  BookOpen,
  Package,
  Monitor,
  Gift,
  Utensils,
  ChevronRight,
  Zap,
  LogOut,
  LogIn,
  Trash2,
  BarChart3,
  TrendingUp,
  Calendar as CalendarIcon,
  ShieldCheck,
  XCircle,
  Clock,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Habit, Reward, UserStats, CompletionLog } from './types';
import { INITIAL_HABITS, INITIAL_REWARDS, XP_PER_LEVEL } from './constants';
import { auth, db, signIn, logOut } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  updateDoc, 
  query, 
  where,
  getDocFromServer,
  deleteDoc,
  addDoc,
  orderBy,
  limit,
  collectionGroup
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie
} from 'recharts';

const ICON_MAP: Record<string, any> = {
  Droplets,
  Sparkles,
  BookOpen,
  Package,
  Monitor,
  Gift,
  Utensils,
  Sword,
  Shield,
  Star,
  Trophy
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const StatsView = ({ completions, habits }: { completions: CompletionLog[], habits: Habit[] }) => {
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const stats = useMemo(() => {
    const now = new Date();
    const data: any[] = [];
    
    if (timeframe === 'daily') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayCompletions = completions.filter(c => c.date === dateStr);
        const uniqueHabits = new Set(dayCompletions.map(c => c.habitId)).size;
        const totalActiveHabits = habits.length || 1;
        const rate = Math.round((uniqueHabits / totalActiveHabits) * 100);
        
        data.push({
          name: d.toLocaleDateString('en-US', { weekday: 'short' }),
          rate,
          count: uniqueHabits
        });
      }
    } else if (timeframe === 'weekly') {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const start = new Date();
        start.setDate(now.getDate() - (i * 7 + now.getDay()));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        
        const weekCompletions = completions.filter(c => {
          const cDate = new Date(c.date);
          return cDate >= start && cDate <= end;
        });
        
        const avgDailyCount = weekCompletions.length / 7;
        const totalActiveHabits = habits.length || 1;
        const rate = Math.round((avgDailyCount / totalActiveHabits) * 100);

        data.push({
          name: `Week ${4-i}`,
          rate,
          count: weekCompletions.length
        });
      }
    } else {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(now.getMonth() - i);
        const month = d.getMonth();
        const year = d.getFullYear();
        
        const monthCompletions = completions.filter(c => {
          const cDate = new Date(c.date);
          return cDate.getMonth() === month && cDate.getFullYear() === year;
        });
        
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const avgDailyCount = monthCompletions.length / daysInMonth;
        const totalActiveHabits = habits.length || 1;
        const rate = Math.round((avgDailyCount / totalActiveHabits) * 100);

        data.push({
          name: d.toLocaleDateString('en-US', { month: 'short' }),
          rate,
          count: monthCompletions.length
        });
      }
    }
    return data;
  }, [completions, habits, timeframe]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    completions.forEach(c => {
      counts[c.category] = (counts[c.category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [completions]);

  const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Battle Statistics</h2>
        <div className="flex bg-slate-800 rounded-lg p-1">
          {(['daily', 'weekly', 'monthly'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                timeframe === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 border-2 border-slate-700 rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-100">Completion Rate</h3>
            <p className="text-xs text-slate-400">Percentage of quests fulfilled</p>
          </div>
        </div>
        
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                unit="%"
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}
                cursor={{ fill: '#334155', opacity: 0.4 }}
              />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {stats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.rate > 80 ? '#10b981' : entry.rate > 50 ? '#6366f1' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 border-2 border-slate-700 rounded-3xl p-6">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 text-center">Focus Areas</h4>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  innerRadius={25}
                  outerRadius={40}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 border-2 border-slate-700 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Total Quests</h4>
          <div className="text-3xl font-black text-white mb-1">{completions.length}</div>
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Fulfilled</p>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserStats | null>(null);
  const [selectedChild, setSelectedChild] = useState<UserStats | null>(null);
  const [children, setChildren] = useState<UserStats[]>([]);
  
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabit, setNewHabit] = useState<Partial<Habit>>({
    name: '',
    description: '',
    points: 10,
    xp: 20,
    category: 'Quest',
    icon: 'Sword',
    requiresApproval: false
  });
  
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [newReward, setNewReward] = useState<Partial<Reward>>({
    title: '',
    description: '',
    pointCost: 50,
    imageUrl: ''
  });
  
  const [habits, setHabits] = useState<Habit[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [completions, setCompletions] = useState<CompletionLog[]>([]);
  const [activeTab, setActiveTab] = useState<'quests' | 'shop' | 'stats' | 'parent'>('quests');
  const [habitFilter, setHabitFilter] = useState<'All' | 'Daily' | 'Quest' | 'Skill'>('All');
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [pendingCompletions, setPendingCompletions] = useState<CompletionLog[]>([]);

  const activeHero = selectedChild || currentUserProfile;

  // Connection test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration in firebase-applet-config.json");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (!currentUser) {
        setCurrentUserProfile(null);
        setSelectedChild(null);
        setChildren([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync User Profile
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserStats;
        setCurrentUserProfile({ ...data, uid: docSnap.id });
      } else {
        // Initialize as parent by default if no profile exists
        const initialProfile: Omit<UserStats, 'uid'> = {
          name: user.displayName || 'Parent',
          userType: 'parent',
          totalPointsBalance: 0,
          lifetimePoints: 0,
          lifetimeTasksCompleted: 0,
          xp: 0,
          level: 1
        };
        setDoc(userRef, initialProfile).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`));
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`));
    return () => unsubscribe();
  }, [user]);

  // Sync Children if parent
  useEffect(() => {
    if (!user || currentUserProfile?.userType !== 'parent') return;
    const childrenQuery = query(collection(db, 'users'), where('parentId', '==', user.uid));
    const unsubscribe = onSnapshot(childrenQuery, (snapshot) => {
      const childrenList = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserStats));
      setChildren(childrenList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => unsubscribe();
  }, [user, currentUserProfile]);

  // Sync Rewards
  useEffect(() => {
    if (!currentUserProfile) return;
    const rewardsRef = collection(db, 'rewards');
    const parentId = currentUserProfile.userType === 'child' ? currentUserProfile.parentId : currentUserProfile.uid;
    if (!parentId) return;

    const q = query(rewardsRef, where('parentId', '==', parentId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rewardsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reward));
      setRewards(rewardsList);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'rewards'));
    return () => unsubscribe();
  }, [currentUserProfile]);

  // Sync Habits for Active Hero
  useEffect(() => {
    if (!activeHero) return;
    const habitsRef = collection(db, 'users', activeHero.uid, 'habits');
    const unsubscribe = onSnapshot(habitsRef, (snapshot) => {
      if (snapshot.empty && activeHero.userType === 'child') {
        // Seed initial habits for children if none exist
        INITIAL_HABITS.forEach(habit => {
          setDoc(doc(habitsRef, habit.id), {
            ...habit,
            parentId: currentUserProfile?.uid || '',
            createdAt: new Date().toISOString()
          }).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${activeHero.uid}/habits/${habit.id}`));
        });
      } else {
        const habitsList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Habit));
        setHabits(habitsList);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${activeHero.uid}/habits`));
    return () => unsubscribe();
  }, [activeHero?.uid]);

  // Sync Completions for Active Hero
  useEffect(() => {
    if (!activeHero) return;
    const completionsRef = collection(db, 'users', activeHero.uid, 'completions');
    const q = query(completionsRef, orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CompletionLog));
      setCompletions(logs);
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${activeHero.uid}/completions`));
    return () => unsubscribe();
  }, [activeHero?.uid]);

  // Sync Pending Completions for Parent
  useEffect(() => {
    if (!user || currentUserProfile?.userType !== 'parent') return;
    const q = query(
      collectionGroup(db, 'completions'),
      where('parentId', '==', user.uid),
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CompletionLog));
      setPendingCompletions(logs);
    }, (error) => {
      // collectionGroup queries might need an index
      console.warn('Pending completions sync error (check if index is required):', error);
    });
    return () => unsubscribe();
  }, [user, currentUserProfile]);

  const addChild = async () => {
    if (!user || !newChildName.trim()) return;
    const childId = `child_${Date.now()}`;
    const childProfile: UserStats = {
      uid: childId,
      name: newChildName.trim(),
      userType: 'child',
      parentId: user.uid,
      totalPointsBalance: 0,
      lifetimePoints: 0,
      lifetimeTasksCompleted: 0,
      xp: 0,
      level: 1
    };

    try {
      await setDoc(doc(db, 'users', childId), childProfile);
      setNewChildName('');
      setIsAddingChild(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${childId}`);
    }
  };

  const addHabit = async () => {
    if (!activeHero || !currentUserProfile || !newHabit.name?.trim()) return;
    const habitId = `habit_${Date.now()}`;
    const habitData: Habit = {
      ...newHabit,
      id: habitId,
      streak: 0,
      lastCompleted: null,
      parentId: currentUserProfile.userType === 'parent' ? currentUserProfile.uid : (currentUserProfile.parentId || ''),
      createdAt: new Date().toISOString()
    } as Habit;

    try {
      await setDoc(doc(db, 'users', activeHero.uid, 'habits', habitId), habitData);
      setIsAddingHabit(false);
      setNewHabit({
        name: '',
        description: '',
        points: 10,
        xp: 20,
        category: 'Quest',
        icon: 'Sword',
        requiresApproval: false
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${activeHero.uid}/habits/${habitId}`);
    }
  };

  const addReward = async () => {
    if (!user || !newReward.title?.trim()) return;
    const rewardId = `reward_${Date.now()}`;
    const rewardData: Reward = {
      ...newReward,
      id: rewardId,
      parentId: user.uid,
      createdAt: new Date().toISOString()
    } as Reward;

    try {
      await setDoc(doc(db, 'rewards', rewardId), rewardData);
      setIsAddingReward(false);
      setNewReward({
        title: '',
        description: '',
        pointCost: 50,
        imageUrl: ''
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `rewards/${rewardId}`);
    }
  };

  const deleteHabit = async (e: React.MouseEvent, habitId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeHero) return;
    console.log('Deleting habit:', habitId, 'for hero:', activeHero.uid);
    try {
      await deleteDoc(doc(db, 'users', activeHero.uid, 'habits', habitId));
      console.log('Habit deleted successfully');
    } catch (e) {
      console.error('Error deleting habit:', e);
      handleFirestoreError(e, OperationType.DELETE, `users/${activeHero.uid}/habits/${habitId}`);
    }
  };

  const deleteReward = async (e: React.MouseEvent, rewardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Deleting reward:', rewardId);
    try {
      await deleteDoc(doc(db, 'rewards', rewardId));
      console.log('Reward deleted successfully');
    } catch (e) {
      console.error('Error deleting reward:', e);
      handleFirestoreError(e, OperationType.DELETE, `rewards/${rewardId}`);
    }
  };

  const approveCompletion = async (log: CompletionLog) => {
    if (!user || currentUserProfile?.userType !== 'parent') return;

    try {
      await updateDoc(doc(db, 'users', log.childId, 'completions', log.id), {
        status: 'approved'
      });

      const childRef = doc(db, 'users', log.childId);
      const childSnap = await getDoc(childRef);
      if (childSnap.exists()) {
        const childData = childSnap.data() as UserStats;
        const newXp = (childData.xp || 0) + log.xpEarned;
        const newPoints = (childData.totalPointsBalance || 0) + log.pointsEarned;
        const newLifetimePoints = (childData.lifetimePoints || 0) + log.pointsEarned;
        const newTasks = (childData.lifetimeTasksCompleted || 0) + 1;
        
        let newLevel = childData.level || 1;
        if (newXp >= newLevel * XP_PER_LEVEL) {
          newLevel += 1;
        }

        await updateDoc(childRef, {
          xp: newXp,
          level: newLevel,
          totalPointsBalance: newPoints,
          lifetimePoints: newLifetimePoints,
          lifetimeTasksCompleted: newTasks
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${log.childId}/completions/${log.id}`);
    }
  };

  const rejectCompletion = async (log: CompletionLog) => {
    if (!user || currentUserProfile?.userType !== 'parent') return;

    try {
      await deleteDoc(doc(db, 'users', log.childId, 'completions', log.id));
      await updateDoc(doc(db, 'users', log.childId, 'habits', log.habitId), {
        lastCompleted: null
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${log.childId}/completions/${log.id}`);
    }
  };

  const completeHabit = async (id: string) => {
    if (!activeHero) return;
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const today = new Date().toISOString().split('T')[0];
    if (habit.lastCompleted === today) return;

    const needsApproval = habit.requiresApproval;

    try {
      if (!needsApproval) {
        const newXp = (activeHero.xp || 0) + habit.xp;
        const newPoints = (activeHero.totalPointsBalance || 0) + habit.points;
        const newLifetimePoints = (activeHero.lifetimePoints || 0) + habit.points;
        const newTasks = (activeHero.lifetimeTasksCompleted || 0) + 1;
        
        let newLevel = activeHero.level || 1;
        if (newXp >= newLevel * XP_PER_LEVEL) {
          newLevel += 1;
          setShowLevelUp(true);
          setTimeout(() => setShowLevelUp(false), 3000);
        }

        await updateDoc(doc(db, 'users', activeHero.uid), {
          xp: newXp,
          level: newLevel,
          totalPointsBalance: newPoints,
          lifetimePoints: newLifetimePoints,
          lifetimeTasksCompleted: newTasks
        });
      }

      const isConsecutive = habit.lastCompleted === new Date(Date.now() - 86400000).toISOString().split('T')[0];
      await updateDoc(doc(db, 'users', activeHero.uid, 'habits', id), {
        streak: isConsecutive ? habit.streak + 1 : 1,
        lastCompleted: today
      });

      await addDoc(collection(db, 'users', activeHero.uid, 'completions'), {
        habitId: id,
        habitName: habit.name,
        date: today,
        timestamp: new Date().toISOString(),
        pointsEarned: habit.points,
        xpEarned: habit.xp,
        category: habit.category,
        status: needsApproval ? 'pending' : 'approved',
        childId: activeHero.uid,
        childName: activeHero.name,
        parentId: activeHero.userType === 'child' ? activeHero.parentId : activeHero.uid
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${activeHero.uid}`);
    }
  };

  const redeemReward = async (reward: Reward) => {
    if (!activeHero || activeHero.totalPointsBalance < reward.pointCost) return;

    try {
      await updateDoc(doc(db, 'users', activeHero.uid), {
        totalPointsBalance: activeHero.totalPointsBalance - reward.pointCost
      });
      alert(`Redeemed: ${reward.title}! Enjoy your reward.`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${activeHero.uid}`);
    }
  };

  const xpProgress = activeHero ? ((activeHero.xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100) : 0;

  const [authError, setAuthError] = useState<{ code: string; message: string; domain: string } | null>(null);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signIn();
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        return;
      }
      setAuthError(error);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="animate-spin text-indigo-500">
          <Zap size={48} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md w-full bg-slate-800 border-2 border-slate-700 rounded-3xl p-8 shadow-2xl"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
            <Sword size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Heroes and Habits</h1>
          <p className="text-slate-400 mb-8 font-medium">Begin your epic journey of self-improvement. Log in to start your quest!</p>
          <button 
            onClick={handleSignIn}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <LogIn size={20} />
            Enter the Realm
          </button>

          {authError && (
            <div className="mt-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm text-left animate-in fade-in slide-in-from-top-4">
              <p className="font-bold mb-1">Login Failed</p>
              <p className="opacity-90 mb-2">{authError.message}</p>
              <div className="text-[10px] opacity-60 font-mono bg-black/30 p-2 rounded">
                Error Code: {authError.code}<br/>
                Current Domain: {authError.domain}
              </div>
              {authError.code === 'auth/unauthorized-domain' && (
                <p className="mt-2 text-xs font-semibold text-red-300">
                  💡 Tip: Add "{authError.domain}" to your Firebase Authorized Domains.
                </p>
              )}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Character Selection Screen for Parents
  if (currentUserProfile?.userType === 'parent' && !selectedChild) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-100 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-black uppercase italic tracking-tighter">Choose Your Hero</h1>
            <button onClick={() => logOut()} className="p-2 text-slate-500 hover:text-white transition-colors">
              <LogOut size={20} />
            </button>
          </div>

            <div className="grid gap-4">
              {children.length > 0 ? (
                children.map(child => (
                  <button 
                    key={child.uid}
                    onClick={() => setSelectedChild(child)}
                    className="bg-slate-800 border-2 border-slate-700 rounded-3xl p-6 flex items-center gap-6 hover:border-indigo-500 transition-all text-left group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                      <Sword size={32} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-black uppercase italic tracking-tight">{child.name}</h2>
                      <div className="flex gap-4 mt-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Level {child.level}</span>
                        <span className="text-xs font-bold text-yellow-500 uppercase tracking-widest">{child.totalPointsBalance} Gold</span>
                      </div>
                    </div>
                    <ChevronRight size={24} className="text-slate-600 group-hover:text-indigo-500 transition-colors" />
                  </button>
                ))
              ) : (
                <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-3xl p-12 text-center">
                  <p className="text-slate-400 mb-4">No heroes found in your party.</p>
                </div>
              )}

              {isAddingChild ? (
                <div className="bg-slate-800 border-2 border-indigo-500 rounded-3xl p-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-4">Summon New Hero</h3>
                  <input 
                    type="text"
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                    placeholder="Hero Name..."
                    className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-4 mb-4 focus:border-indigo-500 outline-none transition-colors"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <button 
                      onClick={addChild}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all"
                    >
                      Summon
                    </button>
                    <button 
                      onClick={() => setIsAddingChild(false)}
                      className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setIsAddingChild(true)}
                  className="bg-slate-800/30 border-2 border-dashed border-slate-700 rounded-3xl p-6 flex items-center justify-center gap-3 hover:border-slate-500 transition-all text-slate-500 hover:text-slate-300 group"
                >
                  <Plus size={24} />
                  <span className="font-black uppercase tracking-widest text-sm">Add New Hero</span>
                </button>
              )}
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Level Up Overlay */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-yellow-500 text-black px-8 py-4 rounded-2xl shadow-[0_0_50px_rgba(234,179,8,0.5)] flex flex-col items-center border-4 border-white">
              <Trophy size={64} className="mb-2 animate-bounce" />
              <h2 className="text-4xl font-black uppercase tracking-tighter italic">Level Up!</h2>
              <p className="text-xl font-bold">You reached Level {activeHero?.level}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header / Stats Bar */}
      <header className="sticky top-0 z-40 bg-[#1e293b]/80 backdrop-blur-md border-b border-slate-700 p-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-indigo-600 border-2 border-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 overflow-hidden">
                  <Sword className="text-white" size={28} />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-xs font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#1e293b]">
                  {activeHero?.level || 1}
                </div>
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight uppercase italic leading-none truncate max-w-[150px]">
                  {activeHero?.name || 'Hero'}
                </h1>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Level {activeHero?.level || 1} Warrior</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-yellow-500">
                  <Coins size={18} />
                  <span className="text-xl font-black tabular-nums">{activeHero?.totalPointsBalance || 0}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Gold Earned</span>
              </div>
              <div className="flex flex-col gap-1">
                {currentUserProfile?.userType === 'parent' && (
                  <button 
                    onClick={() => setSelectedChild(null)}
                    className="p-2 text-indigo-400 hover:text-indigo-300 transition-colors"
                    title="Switch Hero"
                  >
                    <Shield size={20} />
                  </button>
                )}
                <button 
                  onClick={() => logOut()}
                  className="p-2 text-slate-500 hover:text-white transition-colors"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* XP Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Experience</span>
              <span>{(activeHero?.xp || 0) % XP_PER_LEVEL} / {XP_PER_LEVEL} XP</span>
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 pb-24">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button 
            onClick={() => setActiveTab('quests')}
            className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'quests' 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <LayoutDashboard size={16} />
            Quests
          </button>
          <button 
            onClick={() => setActiveTab('shop')}
            className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'shop' 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <ShoppingBag size={16} />
            Shop
          </button>
          <button 
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'stats' 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <BarChart3 size={16} />
            Stats
          </button>
          {currentUserProfile?.userType === 'parent' && (
            <button 
              onClick={() => setActiveTab('parent')}
              className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${
                activeTab === 'parent' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <ShieldCheck size={16} />
              Parent
            </button>
          )}
        </div>

        {activeTab === 'quests' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Active Quests</h2>
              {currentUserProfile?.userType === 'parent' && (
                <button 
                  onClick={() => setIsAddingHabit(true)}
                  className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {isAddingHabit && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="bg-slate-800 border-2 border-indigo-500 rounded-2xl p-6 mb-6 overflow-hidden"
              >
                <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-4">Create New Quest</h3>
                <div className="space-y-4">
                  <input 
                    type="text"
                    placeholder="Quest Name..."
                    value={newHabit.name}
                    onChange={e => setNewHabit({...newHabit, name: e.target.value})}
                    className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 outline-none focus:border-indigo-500 transition-colors"
                  />
                  <textarea 
                    placeholder="Description..."
                    value={newHabit.description}
                    onChange={e => setNewHabit({...newHabit, description: e.target.value})}
                    className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 outline-none focus:border-indigo-500 transition-colors h-20"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Category</label>
                      <select 
                        value={newHabit.category}
                        onChange={e => setNewHabit({...newHabit, category: e.target.value as any})}
                        className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 outline-none focus:border-indigo-500 transition-colors text-slate-200"
                      >
                        <option value="Daily">Daily</option>
                        <option value="Quest">Quest</option>
                        <option value="Skill">Skill</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Icon</label>
                      <select 
                        value={newHabit.icon}
                        onChange={e => setNewHabit({...newHabit, icon: e.target.value})}
                        className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 outline-none focus:border-indigo-500 transition-colors text-slate-200"
                      >
                        {Object.keys(ICON_MAP).map(icon => (
                          <option key={icon} value={icon}>{icon}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Gold Reward</label>
                      <input 
                        type="number"
                        value={newHabit.points}
                        onChange={e => setNewHabit({...newHabit, points: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">XP Reward</label>
                      <input 
                        type="number"
                        value={newHabit.xp}
                        onChange={e => setNewHabit({...newHabit, xp: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-900 border-2 border-slate-700 rounded-xl">
                    <input 
                      type="checkbox"
                      id="requiresApproval"
                      checked={newHabit.requiresApproval}
                      onChange={e => setNewHabit({...newHabit, requiresApproval: e.target.checked})}
                      className="w-5 h-5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
                    />
                    <label htmlFor="requiresApproval" className="text-xs font-black uppercase tracking-widest text-slate-400 cursor-pointer">
                      Requires Parent Approval
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={addHabit}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all"
                    >
                      Create Quest
                    </button>
                    <button 
                      onClick={() => setIsAddingHabit(false)}
                      className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Habit Filters */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
              {(['All', 'Daily', 'Quest', 'Skill'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setHabitFilter(filter)}
                  className={`px-4 py-2 rounded-full font-black uppercase tracking-widest text-[10px] transition-all whitespace-nowrap ${
                    habitFilter === filter 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            
            <div className="grid gap-3">
              {habits
                .filter(h => habitFilter === 'All' || h.category === habitFilter)
                .map((habit) => {
                const Icon = ICON_MAP[habit.icon] || Star;
                const isCompletedToday = habit.lastCompleted === new Date().toISOString().split('T')[0];
                
                return (
                  <motion.div 
                    key={habit.id}
                    layout
                    className={`group relative overflow-hidden rounded-2xl border-2 transition-all ${
                      isCompletedToday 
                      ? 'bg-slate-800/50 border-emerald-500/50 opacity-75' 
                      : 'bg-slate-800 border-slate-700 hover:border-indigo-500/50'
                    }`}
                  >
                    <div className="p-4 flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                        isCompletedToday ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'
                      }`}>
                        <Icon size={24} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-100 truncate">{habit.name}</h3>
                          {habit.streak > 0 && (
                            <div className="flex items-center gap-0.5 text-orange-500 text-[10px] font-black italic">
                              <Flame size={12} fill="currentColor" />
                              {habit.streak}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1">{habit.description}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {currentUserProfile?.userType === 'parent' && (
                          <button 
                            onClick={(e) => deleteHabit(e, habit.id)}
                            className="p-2 text-slate-600 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => completeHabit(habit.id)}
                          disabled={isCompletedToday}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isCompletedToday 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-90'
                          }`}
                        >
                          {isCompletedToday ? <CheckCircle2 size={20} /> : <Zap size={20} />}
                        </button>
                      </div>
                    </div>
                    
                    {/* Rewards Preview */}
                    <div className="px-4 pb-3 flex gap-3">
                      <div className="flex items-center gap-1 text-[10px] font-black text-yellow-500 uppercase tracking-tighter">
                        <Coins size={10} />
                        {habit.points} G
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-black text-indigo-400 uppercase tracking-tighter">
                        <Star size={10} />
                        {habit.xp} XP
                      </div>
                      <div className="ml-auto text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {habit.category}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : activeTab === 'shop' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Merchant's Goods</h2>
              {currentUserProfile?.userType === 'parent' && (
                <button 
                  onClick={() => setIsAddingReward(true)}
                  className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {isAddingReward && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="bg-slate-800 border-2 border-yellow-500 rounded-2xl p-6 mb-6 overflow-hidden"
              >
                <h3 className="text-sm font-black uppercase tracking-widest text-yellow-500 mb-4">Stock New Reward</h3>
                <div className="space-y-4">
                  <input 
                    type="text"
                    placeholder="Reward Title..."
                    value={newReward.title}
                    onChange={e => setNewReward({...newReward, title: e.target.value})}
                    className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 outline-none focus:border-yellow-500 transition-colors"
                  />
                  <textarea 
                    placeholder="Description..."
                    value={newReward.description}
                    onChange={e => setNewReward({...newReward, description: e.target.value})}
                    className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 outline-none focus:border-yellow-500 transition-colors h-20"
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Gold Cost</label>
                      <input 
                        type="number"
                        value={newReward.pointCost}
                        onChange={e => setNewReward({...newReward, pointCost: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 outline-none focus:border-yellow-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Icon Name</label>
                      <input 
                        type="text"
                        placeholder="e.g. Gift"
                        value={newReward.imageHint}
                        onChange={e => setNewReward({...newReward, imageHint: e.target.value})}
                        className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 outline-none focus:border-yellow-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Image URL</label>
                      <input 
                        type="text"
                        placeholder="https://..."
                        value={newReward.imageUrl}
                        onChange={e => setNewReward({...newReward, imageUrl: e.target.value})}
                        className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 outline-none focus:border-yellow-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={addReward}
                      className="flex-1 py-3 bg-yellow-500 text-black hover:bg-yellow-400 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
                    >
                      Stock Reward
                    </button>
                    <button 
                      onClick={() => setIsAddingReward(false)}
                      className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="grid gap-3">
              {rewards.map((reward) => {
                const canAfford = (activeHero?.totalPointsBalance || 0) >= reward.pointCost;
                
                return (
                  <div 
                    key={reward.id}
                    className="bg-slate-800 border-2 border-slate-700 rounded-2xl p-4 flex items-center gap-4 hover:border-yellow-500/50 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center overflow-hidden">
                      {reward.imageUrl ? (
                        <img src={reward.imageUrl} alt={reward.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        (() => {
                          const Icon = ICON_MAP[reward.imageHint || ''] || ShoppingBag;
                          return <Icon size={24} />;
                        })()
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-100">{reward.title}</h3>
                      <p className="text-xs text-slate-400">{reward.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {currentUserProfile?.userType === 'parent' && (
                        <button 
                          onClick={(e) => deleteReward(e, reward.id)}
                          className="p-2 text-slate-600 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => redeemReward(reward)}
                        disabled={!canAfford}
                        className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                          canAfford 
                          ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-lg shadow-yellow-500/20 active:scale-95' 
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {reward.pointCost} G
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeTab === 'parent' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Parent Command Center</h2>
              <button 
                onClick={() => setIsAddingChild(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600/30 transition-colors"
              >
                <UserPlus size={14} />
                Add Hero
              </button>
            </div>

            {/* Pending Approvals */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Clock size={12} />
                Pending Approvals ({pendingCompletions.length})
              </h3>
              
              {pendingCompletions.length === 0 ? (
                <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center">
                  <p className="text-slate-500 text-xs font-medium">No pending quests to approve!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingCompletions.map(log => (
                    <motion.div 
                      key={log.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full">
                            {log.childName}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-200 truncate">{log.habitName}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-bold text-yellow-500 flex items-center gap-1">
                            <Zap size={10} fill="currentColor" /> +{log.pointsEarned} Points
                          </span>
                          <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                            <Sword size={10} /> +{log.xpEarned} XP
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => rejectCompletion(log)}
                          className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors"
                          title="Reject"
                        >
                          <XCircle size={20} />
                        </button>
                        <button 
                          onClick={() => approveCompletion(log)}
                          className="p-2 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-xl transition-colors"
                          title="Approve"
                        >
                          <CheckCircle2 size={20} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Heroes Overview */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Shield size={12} />
                Heroes Overview
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {children.map(child => (
                  <button 
                    key={child.uid}
                    onClick={() => {
                      setSelectedChild(child);
                      setActiveTab('quests');
                    }}
                    className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center gap-4 hover:border-indigo-500/50 transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:scale-110 transition-transform">
                      {child.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-bold text-slate-200">{child.name}</h4>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Level {child.level}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-500">
                          <Zap size={10} fill="currentColor" /> {child.totalPointsBalance}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-400">
                          <Sword size={10} /> {child.xp} XP
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                          <CheckCircle2 size={10} /> {child.lifetimeTasksCompleted} Done
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <StatsView completions={completions} habits={habits} />
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-[#1e293b] border-t border-slate-700 p-4 flex justify-around items-center md:hidden">
        <button className="text-indigo-500 flex flex-col items-center gap-1">
          <LayoutDashboard size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Quests</span>
        </button>
        <button className="text-slate-500 flex flex-col items-center gap-1">
          <ShoppingBag size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Shop</span>
        </button>
        <button className="text-slate-500 flex flex-col items-center gap-1">
          <Trophy size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Feats</span>
        </button>
      </nav>
    </div>
  );
}
