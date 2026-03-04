export type UserRole = "ADMIN" | "USER";

export interface Category {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  password?: string; // For prototype simplicity
  role: UserRole;
  linkedCategories: string[]; // IDs of Categories
  historyCount: number;
  totalEvents: number;
  lastParticipation: string | null;
  roleStats: Record<string, { // Role is now category ID or Name
    count: number;
    lastDate: string | null;
  }>;
  priorityReplenishment: boolean;
  isActive: boolean;
}

export interface ScheduleAssignment {
  categoryId: string;
  userId: string;
  confirmed: boolean;
  assignedBy?: 'auto' | 'manual';
}

export interface EventSchedule {
  id: string;
  date: string; // ISO Date YYYY-MM-DD
  name?: string; // Added: Name of the event
  assignments: ScheduleAssignment[];
  isFixed: boolean; // Admin fixed this day for an event
  isFinalized: boolean; // Added: Scale finalized by Admin
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
