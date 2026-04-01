export interface Habit {
  id: string;
  name: string;
  description: string;
  points: number;
  xp: number;
  icon: string;
  streak: number;
  lastCompleted: string | null; // ISO date
  category: 'Quest' | 'Daily' | 'Skill';
  requiresApproval?: boolean;
  parentId?: string;
  childId?: string; // The child this habit belongs to
  createdAt?: string;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  pointCost: number;
  imageUrl?: string;
  imageHint?: string;
  stockQuantity?: number;
  parentId?: string;
  createdAt?: string;
}

export interface UserStats {
  uid: string;
  name: string;
  userType: 'parent' | 'child';
  parentId?: string;
  totalPointsBalance: number;
  lifetimePoints: number;
  lifetimeTasksCompleted: number;
  level: number; // We'll keep level as a calculated or stored field for the RPG feel
  xp: number;
  parentPin?: string; // 4-digit PIN for Parent Zone access
}

export interface CompletionLog {
  id: string;
  habitId: string;
  habitName: string;
  date: string; // ISO date string (YYYY-MM-DD)
  timestamp: string; // ISO date-time string
  pointsEarned: number;
  xpEarned: number;
  category: string;
  status: 'pending' | 'approved';
  childId: string;
  childName: string;
  parentId: string;
}
