import { User, Category } from "../types";

export const MOCK_CATEGORIES: Category[] = [
  { id: "cat_audio", name: "Áudio" },
  { id: "cat_video", name: "Vídeo" },
  { id: "cat_palco", name: "Palco" },
  { id: "cat_mic", name: "Microfone Volante" },
  { id: "cat_indicadores", name: "Gestão de Indicadores" },
];

const emptyRoleStats = (): Record<string, { count: number; lastDate: string | null }> => {
  const stats: Record<string, { count: number; lastDate: string | null }> = {};
  MOCK_CATEGORIES.forEach(cat => {
    stats[cat.id] = { count: 0, lastDate: null };
  });
  return stats;
};

export const MOCK_USERS: User[] = [
  {
    id: "admin_1",
    name: "Administrador",
    phone: "admin",
    password: "admin",
    role: "ADMIN",
    linkedCategories: MOCK_CATEGORIES.map(c => c.id),
    historyCount: 10,
    totalEvents: 20,
    lastParticipation: "2026-02-28",
    roleStats: emptyRoleStats(),
    priorityReplenishment: false,
    isActive: true,
  },
  {
    id: "user_1",
    name: "João Silva",
    phone: "11888888888",
    password: "user",
    role: "USER",
    linkedCategories: ["cat_audio", "cat_mic"],
    historyCount: 8,
    totalEvents: 20,
    lastParticipation: "2026-02-20",
    roleStats: {
      ...emptyRoleStats(),
      "cat_mic": { count: 3, lastDate: "2026-02-10" },
      "cat_audio": { count: 5, lastDate: "2026-02-20" },
    },
    priorityReplenishment: false,
    isActive: true,
  },
  {
    id: "user_2",
    name: "Maria Santos",
    phone: "11777777777",
    password: "user",
    role: "USER",
    linkedCategories: ["cat_indicadores", "cat_palco"],
    historyCount: 9,
    totalEvents: 20,
    lastParticipation: "2026-02-25",
    roleStats: {
      ...emptyRoleStats(),
      "cat_indicadores": { count: 4, lastDate: "2026-02-15" },
      "cat_palco": { count: 5, lastDate: "2026-02-25" },
    },
    priorityReplenishment: false,
    isActive: true,
  },
  {
    id: "user_3",
    name: "Pedro Costa",
    phone: "11666666666",
    password: "user",
    role: "USER",
    linkedCategories: ["cat_video"],
    historyCount: 5,
    totalEvents: 20,
    lastParticipation: "2026-02-15",
    roleStats: {
      ...emptyRoleStats(),
      "cat_video": { count: 5, lastDate: "2026-02-15" },
    },
    priorityReplenishment: false,
    isActive: true,
  },
];
