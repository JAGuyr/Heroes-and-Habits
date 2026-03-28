import { Habit, Reward } from './types';

export const INITIAL_HABITS: Habit[] = [
  {
    id: '1',
    name: 'Morning Potion (Water)',
    description: 'Drink a full glass of water to start your day.',
    points: 10,
    xp: 20,
    icon: 'Droplets',
    streak: 0,
    lastCompleted: null,
    category: 'Daily',
  },
  {
    id: '2',
    name: 'Armor Polish (Brush Teeth)',
    description: 'Brush your teeth for 2 minutes.',
    points: 15,
    xp: 30,
    icon: 'Sparkles',
    streak: 0,
    lastCompleted: null,
    category: 'Daily',
  },
  {
    id: '3',
    name: 'Scholar\'s Study (Homework)',
    description: 'Complete 20 minutes of focused learning.',
    points: 50,
    xp: 100,
    icon: 'BookOpen',
    streak: 0,
    lastCompleted: null,
    category: 'Quest',
  },
  {
    id: '4',
    name: 'Inventory Sort (Clean Room)',
    description: 'Put away 5 items in your room.',
    points: 30,
    xp: 60,
    icon: 'Package',
    streak: 0,
    lastCompleted: null,
    category: 'Skill',
  },
];

export const INITIAL_REWARDS: Reward[] = [
  {
    id: 'r1',
    title: 'Screen Time Scroll',
    description: '30 minutes of extra gaming or videos.',
    pointCost: 100,
    imageHint: 'Monitor',
  },
  {
    id: 'r2',
    title: 'Treasure Chest (Small Toy)',
    description: 'Pick a small toy from the treasure box.',
    pointCost: 500,
    imageHint: 'Gift',
  },
  {
    id: 'r3',
    title: 'Feast of Choice',
    description: 'Choose what we have for dinner tonight!',
    pointCost: 300,
    imageHint: 'Utensils',
  },
];

export const XP_PER_LEVEL = 500;
