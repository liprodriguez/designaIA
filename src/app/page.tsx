"use client";

import { useState, useEffect } from "react";
import { User, Category, EventSchedule, AuthState, UserRole } from "@/types";
import { MOCK_USERS, MOCK_CATEGORIES } from "@/lib/mockData";
import { generateAutoSchedule } from "@/lib/scheduler";
import { supabase } from "@/lib/supabase"; // Importação que você já tinha
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar as CalendarIcon, 
  Users, 
  Settings, 
  LogOut, 
  CheckCircle, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Sparkles,
  Cloud // Adicionei o ícone de nuvem aqui
} from "lucide-react";

export default function Home() {
  // --- State ---
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<EventSchedule[]>([]);
  const [auth, setAuth] = useState<AuthState>({ user: null, isAuthenticated: false });
  const [isClient, setIsClient] = useState(false);
  
  // NOVA VARIÁVEL DE ESTADO PARA O BOTÃO
  const [isSyncing, setIsSyncing] = useState(false);

  // ... (mantenha todos os seus outros states: Navigation, Modals, Form states exatamente como estavam)
  const [activeTab, setActiveTab] = useState<"dashboard" | "calendar" | "users" | "categories" | "history" | "template">("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventSchedule | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [eventName, setEventName] = useState("");
  const [whatsappTemplate, setWhatsappTemplate] = useState("Olá {{nome}}, você foi escalado para a função {{funcao}} no dia {{data}}. Por favor, confirme no sistema.");
  const [historyStart, setHistoryStart] = useState("");
  const [historyEnd, setHistoryEnd] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState("");
  const [regLogin, setRegLogin] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPass, setRegPass] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserLogin, setNewUserLogin] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("USER");
  const [newUserCats, setNewUserCats] = useState<string[]>([]);
  const [lastCreatedUser, setLastCreatedUser] = useState<User | null>(null);
  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  // --- NOVA FUNÇÃO DE SINCRONIZAÇÃO (Sem alterar o resto) ---
  const handleManualSync = async () => {
    if (!isSupabaseConfigured()) return alert("Configuração do Supabase pendente.");
    setIsSyncing(true);
    try {
      // Sincroniza usuários salvos no estado para a tabela 'perfis'
      for (const user of users) {
        await supabase.from('perfis').upsert({
          id: user.id,
          name: user.name,
          phone: user.phone,
          password: user.password,
          role: user.role,
          history_count: user.historyCount,
          total_events: user.totalEvents,
          last_participation: user.lastParticipation,
          role_stats: user.roleStats,
          is_active: user.isActive
        });
      }
      // Sincroniza eventos para a tabela 'event_schedules'
      for (const event of events) {
        await supabase.from('event_schedules').upsert({
          id: event.id,
          date: event.date,
          name: event.name,
          assignments: event.assignments,
          is_fixed: event.isFixed,
          is_finalized: event.isFinalized
        });
      }
      alert("Sincronização concluída!");
    } catch (error: any) {
      alert("Erro ao sincronizar: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // ... (Mantenha todos os seus useEffects, normalizePhone e isSupabaseConfigured exatamente como enviou originalmente)

  useEffect(() => {
    setIsClient(true);
    const savedUsers = localStorage.getItem("designaia_users");
    const savedCats = localStorage.getItem("designaia_categories");
    const savedEvents = localStorage.getItem("designaia_events");
    const savedAuth = localStorage.getItem("designaia_auth");
    const savedTemplate = localStorage.getItem("designaia_template");

    if (savedUsers) {
      const parsed = JSON.parse(savedUsers);
      const adminPadrão = MOCK_USERS[0];
      const outrosUsers = parsed.filter((u: User) => u.id !== adminPadrão.id && u.phone !== adminPadrão.phone);
      setUsers([adminPadrão, ...outrosUsers]);
    } else {
      setUsers(MOCK_USERS);
    }

    if (savedCats) setCategories(JSON.parse(savedCats));
    else setCategories(MOCK_CATEGORIES);

    if (savedEvents) setEvents(JSON.parse(savedEvents));
    if (savedAuth) setAuth(JSON.parse(savedAuth));
    if (savedTemplate) setWhatsappTemplate(savedTemplate);

    const syncWithSupabase = async () => {
      if (isSupabaseConfigured()) {
        try {
          const { data: dbUsers, error } = await supabase.from('perfis').select('*');
          if (error) throw error;
          if (dbUsers) {
            const mappedUsers: User[] = dbUsers.map(u => ({
              ...u,
              role: u.role as UserRole,
              linkedCategories: [],
              historyCount: u.history_count || 0,
              totalEvents: u.total_events || 0,
              lastParticipation: u.last_participation || null,
              roleStats: u.role_stats || {},
              isActive: true
            }));
            const adminPadrao = MOCK_USERS[0];
            const outrosUsers = mappedUsers.filter(u => u.id !== adminPadrao.id && u.phone !== adminPadrao.phone);
            const uniqueUsers = Array.from(new Map([adminPadrao, ...outrosUsers].map(u => [u.id, u])).values());
            setUsers(uniqueUsers);
          }
        } catch (err: any) {
          console.error("Erro na sincronização inicial:", err.message);
        }
      }
    };
    syncWithSupabase();
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem("designaia_users", JSON.stringify(users));
      localStorage.setItem("designaia_categories", JSON.stringify(categories));
      localStorage.setItem("designaia_events", JSON.stringify(events));
      localStorage.setItem("designaia_auth", JSON.stringify(auth));
      localStorage.setItem("designaia_template", whatsappTemplate);
    }
  }, [users, categories, events, auth, whatsappTemplate, isClient]);

  const normalizePhone = (phone: string) => {
    if (phone.toLowerCase() === "admin") return "admin";
    const hasLetters = /[a-zA-Z]/.test(phone);
    if (hasLetters) return phone.trim();
    return phone.replace(/\D/g, "");
  };
  
  const isSupabaseConfigured = () => {
    return process.env.NEXT_PUBLIC_SUPABASE_URL && 
           !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
           process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
           !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder');
  };

  // ... (Mantenha TODOS os seus Handlers: handleLogin, handleRegister, toggleDayFixed, etc, exatamente como estavam no seu arquivo original)

  if (!isClient) return null;

  if (!auth.isAuthenticated) {
    // Render do seu login original
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        {/* ... (Todo o seu JSX de Login/Register aqui) */}
      </div>
    );
  }

  const isAdmin = auth.user?.role === "ADMIN";

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      {/* Sidebar - Recuperando seu estilo original */}
      <aside className="w-full md:w-64 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-6 border-b border-zinc-100">
          <h1 className="text-2xl font-bold text-blue-600">designaIA</h1>
          <p className="text-xs text-zinc-400 uppercase tracking-widest mt-1">Versão 2.0</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {/* BOTÃO DE SINCRONIZAÇÃO INSERIDO NO SEU VISUAL ORIGINAL */}
          {isAdmin && (
            <button 
              onClick={handleManualSync}
              disabled={isSyncing}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all mb-4 ${isSyncing ? 'bg-zinc-100 text-zinc-400' : 'bg-blue-600 text-white shadow-lg hover:bg-blue-700'}`}
            >
              <Cloud size={20} className={isSyncing ? "animate-spin" : ""} /> 
              {isSyncing ? "Sincronizando..." : "Sincronizar Nuvem"}
            </button>
          )}

          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === "dashboard" ? "bg-blue-50 text-blue-600 font-bold" : "text-zinc-500 hover:bg-zinc-50"}`}
          >
            <Clock size={20} /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab("calendar")}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === "calendar" ? "bg-blue-50 text-blue-600 font-bold" : "text-zinc-500 hover:bg-zinc-50"}`}
          >
            <CalendarIcon size={20} /> Calendário
          </button>
          {isAdmin && (
            <>
              <button 
                onClick={() => setActiveTab("users")}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === "users" ? "bg-blue-50 text-blue-600 font-bold" : "text-zinc-500 hover:bg-zinc-50"}`}
              >
                <Users size={20} /> Usuários
              </button>
              <button 
                onClick={() => setActiveTab("categories")}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === "categories" ? "bg-blue-50 text-blue-600 font-bold" : "text-zinc-500 hover:bg-zinc-50"}`}
              >
                <Settings size={20} /> Categorias
              </button>
              {/* ... (Continue com seus botões de Histórico e Template) */}
            </>
          )}
        </nav>
        {/* ... (Resto da sua Sidebar e Main Content com todas as Tabs) */}
      </main>
    </div>
  );
}
