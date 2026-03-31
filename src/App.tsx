/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Habit, Reward, UserStats } from './types';
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
  deleteDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

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
    icon: 'Sword'
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
  const [activeTab, setActiveTab] = useState<'quests' | 'shop'>('quests');
  const [showLevelUp, setShowLevelUp] = useState(false);

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
            parentId: currentUserProfile.uid,
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
      parentId: currentUserProfile.uid,
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
        icon: 'Sword'
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

  const completeHabit = async (id: string) => {
    if (!activeHero) return;
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const today = new Date().toISOString().split('T')[0];
    if (habit.lastCompleted === today) return;

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

    try {
      // Update stats
      await updateDoc(doc(db, 'users', activeHero.uid), {
        xp: newXp,
        level: newLevel,
        totalPointsBalance: newPoints,
        lifetimePoints: newLifetimePoints,
        lifetimeTasksCompleted: newTasks
      });

      // Update habit
      const isConsecutive = habit.lastCompleted === new Date(Date.now() - 86400000).toISOString().split('T')[0];
      await updateDoc(doc(db, 'users', activeHero.uid, 'habits', id), {
        streak: isConsecutive ? habit.streak + 1 : 1,
        lastCompleted: today
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
            
            <div className="grid gap-3">
              {habits.map((habit) => {
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
        ) : (
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
