import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DE CONEXÃO ---
const supabaseUrl = 'https://djunuewwlzttyxvtitie.supabase.co';
const supabaseAnonKey = 'sb_publishable_ArD1cIRTEcBjWGt7ZN1TMA_YO2PRPvh';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- DEFINIÇÕES DE TIPOS (Originais) ---
export type UserRole = "ADMIN" | "USER";

export interface Category {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  password?: string;
  role: UserRole;
  linkedCategories: string[];
  historyCount: number;
  totalEvents: number;
  lastParticipation: string | null;
  roleStats: Record<string, {
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
  date: string;
  name?: string;
  assignments: ScheduleAssignment[];
  isFixed: boolean;
  isFinalized: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

// --- FUNÇÕES DE SINCRONIZAÇÃO ---

/**
 * Envia o usuário atual e as escalas do LocalStorage para o Supabase
 */
export const syncToSupabase = async () => {
  try {
    // 1. Busca os dados salvos pelo seu app no navegador
    // Nota: Verifique se o seu app usa esses nomes exatos ('user_data' e 'schedules')
    const localUser = localStorage.getItem('user_data');
    const localSchedules = localStorage.getItem('schedules');

    if (!localUser) throw new Error("Nenhum dado de usuário encontrado localmente.");

    const userData: User = JSON.parse(localUser);

    // 2. Salva no banco de dados (Tabela: profiles)
    const { error: userError } = await supabase
      .from('profiles')
      .upsert({
        id: userData.id,
        name: userData.name,
        phone: userData.phone,
        role: userData.role,
        linked_categories: userData.linkedCategories,
        history_count: userData.historyCount,
        total_events: userData.totalEvents,
        last_participation: userData.lastParticipation,
        role_stats: userData.roleStats,
        priority_replenishment: userData.priorityReplenishment,
        is_active: userData.isActive
      });

    if (userError) throw userError;

    // 3. Salva as escalas se existirem (Tabela: event_schedules)
    if (localSchedules) {
      const schedulesData: EventSchedule[] = JSON.parse(localSchedules);
      const { error: scheduleError } = await supabase
        .from('event_schedules')
        .upsert(schedulesData.map(s => ({
          id: s.id,
          date: s.date,
          name: s.name,
          assignments: s.assignments,
          is_fixed: s.isFixed,
          is_finalized: s.isFinalized
        })));

      if (scheduleError) throw scheduleError;
    }

    console.log("Sincronização realizada com sucesso!");
    return { success: true };

  } catch (error: any) {
    console.error("Erro na sincronização:", error.message);
    return { success: false, error: error.message };
  }
};
