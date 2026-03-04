"use client";

import { useState, useEffect } from "react";
import { User, Category, EventSchedule, AuthState, UserRole } from "@/types";
import { MOCK_USERS, MOCK_CATEGORIES } from "@/lib/mockData";
import { generateAutoSchedule } from "@/lib/scheduler";
import { supabase } from "@/lib/supabase";
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
  Sparkles
} from "lucide-react";

export default function Home() {
  // --- State ---
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<EventSchedule[]>([]);
  const [auth, setAuth] = useState<AuthState>({ user: null, isAuthenticated: false });
  const [isClient, setIsClient] = useState(false);
  
  // Navigation
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

  // WhatsApp Template
  const [whatsappTemplate, setWhatsappTemplate] = useState("Olá {{nome}}, você foi escalado para a função {{funcao}} no dia {{data}}. Por favor, confirme no sistema.");

  // History Filter States
  const [historyStart, setHistoryStart] = useState("");
  const [historyEnd, setHistoryEnd] = useState("");

  // Form states
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPass, setRegPass] = useState("");

  // New User Modal States
  const [newUserName, setNewUserName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("USER");
  const [newUserCats, setNewUserCats] = useState<string[]>([]);
  const [lastCreatedUser, setLastCreatedUser] = useState<User | null>(null);

  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  // --- Effects ---
  useEffect(() => {
    setIsClient(true);
    const savedUsers = localStorage.getItem("designaia_users");
    const savedCats = localStorage.getItem("designaia_categories");
    const savedEvents = localStorage.getItem("designaia_events");
    const savedAuth = localStorage.getItem("designaia_auth");
    const savedTemplate = localStorage.getItem("designaia_template");

    if (savedUsers) {
      const parsed = JSON.parse(savedUsers);
      // Garantir que o admin/admin padrão sempre exista e seja o único com esse ID/Username
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

    // Sincronizar com Supabase se disponível
    const syncWithSupabase = async () => {
      if (isSupabaseConfigured()) {
        console.log("Sincronizando dados com Supabase...");
        try {
          const { data: dbUsers, error } = await supabase.from('perfis').select('*');
          if (error) throw error;
          if (dbUsers) {
            const mappedUsers: User[] = dbUsers.map(u => ({
              ...u,
              role: u.role as UserRole,
              linkedCategories: u.linked_categories || [],
              historyCount: u.history_count || 0,
              totalEvents: u.total_events || 0,
              lastParticipation: u.last_participation || null,
              roleStats: u.role_stats || {},
              isActive: true
            }));
            
            // Unicidade absoluta por ID para evitar erro de chaves duplicadas no React
            const adminPadrao = MOCK_USERS[0];
            const outrosUsers = mappedUsers.filter(u => u.id !== adminPadrao.id && u.phone !== adminPadrao.phone);
            const uniqueUsers = Array.from(new Map([adminPadrao, ...outrosUsers].map(u => [u.id, u])).values());
            setUsers(uniqueUsers);
          }
        } catch (err: any) {
          console.error("Erro na sincronização inicial com Supabase:", err.message);
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

  // --- Utils ---
  const normalizePhone = (phone: string) => {
    // Se for "admin" (insensível a maiúsculas), tratamos como username literal
    if (phone.toLowerCase() === "admin") return "admin";
    
    // Se contiver letras, provavelmente é um username e não um telefone
    const hasLetters = /[a-zA-Z]/.test(phone);
    if (hasLetters) return phone.trim();
    
    // Caso contrário, normalizamos como telefone numérico
    return phone.replace(/\D/g, "");
  };
  
  const isSupabaseConfigured = () => {
    return process.env.NEXT_PUBLIC_SUPABASE_URL && 
           !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
           process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
           !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder');
  };

  // --- Auth Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsAuthenticating(true);
    
    const cleanPhone = normalizePhone(loginPhone.trim());
    const cleanPass = loginPass.trim();

    console.log("Iniciando tentativa de login:", { phone: cleanPhone });

    try {
      let loggedUser: User | null = null;

      // 1. Tentar Login via Supabase (se configurado)
      if (isSupabaseConfigured()) {
        console.log("Consultando Supabase por Usuário/Telefone...");
        const { data: profiles, error } = await supabase
          .from('perfis')
          .select('*')
          .eq('phone', cleanPhone);

        if (error) {
          console.error("Erro técnico na consulta ao Supabase:", error.message);
        }

        if (profiles && profiles.length > 0) {
          const profile = profiles.find(p => p.password === cleanPass);
          if (profile) {
            console.log("Login via Supabase bem-sucedido:", profile.name);
            loggedUser = {
              ...profile,
              role: profile.role as UserRole,
              linkedCategories: profile.linked_categories || []
            };
          } else {
            console.warn("Senha não confere para o usuário encontrado no Supabase.");
          }
        }
      }

      // 2. Fallback para LocalStorage/Mock (para testes ou se offline)
      if (!loggedUser) {
        console.log("Tentando fallback para usuários locais/mock. Total usuários:", users.length);
        const user = users.find(u => {
          const uIdentifier = normalizePhone(u.phone);
          const matchPhoneOrUser = uIdentifier === cleanPhone;
          const matchPass = u.password === cleanPass;
          
          if (matchPhoneOrUser && !matchPass) {
            console.warn("Usuário local encontrado, mas a senha falhou na comparação.");
          }
          
          return matchPhoneOrUser && matchPass;
        });

        if (user) {
          console.log("Login local bem-sucedido para:", user.name);
          loggedUser = user;
        }
      }

      if (loggedUser) {
        setAuth({ user: loggedUser, isAuthenticated: true });
      } else {
        const userExists = users.some(u => normalizePhone(u.phone) === cleanPhone);
        const errorMsg = userExists ? "Senha incorreta." : "Usuário ou telefone não encontrado.";
        setLoginError(errorMsg);
        console.error(`Falha no login: ${errorMsg}. Tentado: ${cleanPhone}`);
      }
    } catch (err: any) {
      console.error("Falha crítica no processo de login:", err.message);
      setLoginError("Erro inesperado ao realizar login. Tente novamente.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizePhone(regPhone.trim());
    const cleanName = regName.trim();
    const cleanPass = regPass.trim();

    // Verificação de duplicidade local
    if (users.some(u => normalizePhone(u.phone) === cleanPhone)) {
      alert("Este telefone já está cadastrado no sistema.");
      return;
    }

    const userId = Math.random().toString(36).substr(2, 9);

    try {
      if (isSupabaseConfigured()) {
        console.log("Registrando no Supabase:", { name: cleanName, phone: cleanPhone });
        const { error } = await supabase
          .from('perfis')
          .insert([{ 
            id: userId,
            name: cleanName, 
            phone: cleanPhone, 
            password: cleanPass,
            role: "USER",
            linked_categories: [],
            history_count: 0,
            total_events: 0
          }]);

        if (error) {
          console.error("Erro ao registrar no Supabase:", error.message);
          alert(`Erro no cadastro (Supabase): ${error.message}`);
          return;
        }
      }

      // Registro local também para manter consistência no protótipo
      const newUser: User = {
        id: userId,
        name: cleanName,
        phone: cleanPhone,
        password: cleanPass,
        role: "USER",
        linkedCategories: [],
        historyCount: 0,
        totalEvents: 0,
        lastParticipation: null,
        roleStats: {},
        priorityReplenishment: false,
        isActive: true
      };
      setUsers([...users, newUser]);
      setIsRegistering(false);
      alert("Cadastro realizado com sucesso! Agora você pode fazer login.");
    } catch (err: any) {
      console.error("Falha no processo de cadastro:", err.message);
      alert("Ocorreu um erro inesperado ao realizar o cadastro.");
    }
  };

  const handleLogout = () => {
    setAuth({ user: null, isAuthenticated: false });
  };

  // --- Admin Handlers ---
  const toggleDayFixed = (date: Date) => {
    if (auth.user?.role !== "ADMIN") return;
    const dateStr = format(date, "yyyy-MM-dd");
    const existingEvent = events.find(e => e.date === dateStr);

    if (existingEvent) {
      setEditingEvent(existingEvent);
      setEventDate(existingEvent.date);
      setEventName(existingEvent.name || "");
      setIsEventModalOpen(true);
    } else {
      setEditingEvent(null);
      setEventDate(dateStr);
      setEventName("");
      setIsEventModalOpen(true);
    }
  };

  const handleAutoGenerate = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const newAssignments = generateAutoSchedule(users, categories);
    setEvents(events.map(e => 
      e.id === eventId ? { ...e, assignments: newAssignments } : e
    ));
  };

  const handleManualEditAssignment = (eventId: string, categoryId: string, userId: string) => {
    if (!isAdmin) return;
    setEvents(events.map(e => {
      if (e.id === eventId) {
        const existing = e.assignments.find(a => a.categoryId === categoryId);
        const others = e.assignments.filter(a => a.categoryId !== categoryId);
        return {
          ...e,
          assignments: [
            ...others,
            { categoryId, userId, confirmed: false, assignedBy: 'manual' }
          ]
        };
      }
      return e;
    }));
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEvent) {
      setEvents(events.map(ev => 
        ev.id === editingEvent.id ? { ...ev, name: eventName, date: eventDate } : ev
      ));
    } else {
      const newEvent: EventSchedule = {
        id: Math.random().toString(36).substr(2, 9),
        date: eventDate,
        name: eventName,
        assignments: [],
        isFixed: true,
        isFinalized: false
      };
      setEvents([...events, newEvent]);
    }
    setIsEventModalOpen(false);
    setEditingEvent(null);
  };

  const handleDeleteEvent = (eventId: string) => {
    if (!confirm("Deseja realmente excluir este evento?")) return;
    setEvents(events.filter(e => e.id !== eventId));
    setIsEventModalOpen(false);
    setEditingEvent(null);
  };

  const handleConfirmAssignment = (eventId: string) => {
    if (!auth.user) return;
    setEvents(events.map(e => {
      if (e.id === eventId) {
        return {
          ...e,
          assignments: e.assignments.map(a => 
            a.userId === auth.user!.id ? { ...a, confirmed: true } : a
          )
        };
      }
      return e;
    }));
    alert("Designação confirmada com sucesso!");
  };

  const handleRemoveAssignment = (eventId: string, userId: string) => {
    if (!isAdmin) return;

    const shouldPrioritize = window.confirm("Deseja dar prioridade a este usuário na próxima escala?");

    setEvents(events.map(e => 
      e.id === eventId 
        ? { ...e, assignments: e.assignments.filter(a => a.userId !== userId) } 
        : e
    ));

    if (shouldPrioritize) {
      setUsers(users.map(u => 
        u.id === userId ? { ...u, priorityReplenishment: true } : u
      ));
      alert("Usuário removido e marcado como prioritário.");
    } else {
      alert("Usuário removido.");
    }
  };

  const handleFinalizeEvent = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    if (!confirm("Isso atualizará o histórico de todos os usuários escalados. Deseja continuar?")) return;

    const updatedUsers = users.map(user => {
      const assignment = event.assignments.find(a => a.userId === user.id);
      if (assignment) {
        return {
          ...user,
          historyCount: user.historyCount + 1,
          totalEvents: user.totalEvents + 1,
          lastParticipation: event.date,
          priorityReplenishment: false,
          roleStats: {
            ...user.roleStats,
            [assignment.categoryId]: {
              count: (user.roleStats[assignment.categoryId]?.count || 0) + 1,
              lastDate: event.date
            }
          }
        };
      } else {
        return {
          ...user,
          totalEvents: user.totalEvents + 1
        };
      }
    });

    setUsers(updatedUsers);
    setEvents(events.map(e => e.id === eventId ? { ...e, isFinalized: true } : e));
    alert("Escala finalizada com sucesso! A edição foi travada.");
  };

  const handleReopenEvent = (eventId: string) => {
    if (!isAdmin) return;
    if (!confirm("Deseja reabrir a escala para edição?")) return;
    setEvents(events.map(e => e.id === eventId ? { ...e, isFinalized: false } : e));
  };

  const handleShareIndividualWhatsApp = (userId: string, categoryId: string, eventDate: string) => {
    const user = users.find(u => u.id === userId);
    const cat = categories.find(c => c.id === categoryId);
    if (!user || !cat) return;

    const formattedDate = format(new Date(eventDate), "dd/MM/yyyy");
    
    let message = whatsappTemplate
      .replace("{{nome}}", user.name)
      .replace("{{funcao}}", cat.name)
      .replace("{{data}}", formattedDate);

    window.open(`https://api.whatsapp.com/send?phone=${user.phone.replace(/\D/g, '')}&text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizePhone(newUserPhone.trim());
    const cleanName = newUserName.trim();
    const cleanPass = newUserPass.trim();

    if (!editingUser && users.some(u => normalizePhone(u.phone) === cleanPhone)) {
      alert("Telefone já cadastrado.");
      return;
    }

    try {
      if (editingUser) {
        if (isSupabaseConfigured()) {
          const { error } = await supabase
            .from('perfis')
            .update({
              name: cleanName,
              phone: cleanPhone,
              password: cleanPass || editingUser.password,
              role: newUserRole,
              linked_categories: newUserCats
            })
            .eq('id', editingUser.id);

          if (error) throw error;
        }

        const updatedUser: User = {
          ...editingUser,
          name: cleanName,
          phone: cleanPhone,
          password: cleanPass || editingUser.password,
          role: newUserRole,
          linkedCategories: newUserCats,
        };
        setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u));
        setEditingUser(null);
        alert("Usuário atualizado com sucesso!");
      } else {
        const userId = Math.random().toString(36).substr(2, 9);
        
        if (isSupabaseConfigured()) {
          const { error } = await supabase
            .from('perfis')
            .insert([{
              id: userId,
              name: cleanName,
              phone: cleanPhone,
              password: cleanPass || "designa123",
              role: newUserRole,
              linked_categories: newUserCats,
              history_count: 0,
              total_events: 0
            }]);

          if (error) throw error;
        }

        const newUser: User = {
          id: userId,
          name: cleanName,
          phone: cleanPhone,
          password: cleanPass || "designa123", // Default password if empty
          role: newUserRole,
          linkedCategories: newUserCats,
          historyCount: 0,
          totalEvents: 0,
          lastParticipation: null,
          roleStats: {},
          priorityReplenishment: false,
          isActive: true
        };
        setUsers([...users, newUser]);
        setLastCreatedUser(newUser);
      }

      setIsNewUserModalOpen(false);
      // Reset form
      setNewUserName("");
      setNewUserPhone("");
      setNewUserPass("");
      setNewUserRole("USER");
      setNewUserCats([]);
    } catch (err: any) {
      console.error("Erro ao salvar usuário:", err.message);
      alert(`Erro ao salvar: ${err.message}`);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setNewUserName(user.name);
    setNewUserPhone(user.phone);
    setNewUserPass(""); // We don't show the password
    setNewUserRole(user.role);
    setNewUserCats(user.linkedCategories);
    setIsNewUserModalOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === auth.user?.id) {
      alert("Você não pode excluir a sua própria conta.");
      return;
    }
    if (confirm("Tem certeza que deseja excluir este usuário? Todas as suas designações passadas serão mantidas no histórico.")) {
      try {
        if (isSupabaseConfigured()) {
          const { error } = await supabase
            .from('perfis')
            .delete()
            .eq('id', userId);
          if (error) throw error;
        }
        setUsers(users.filter(u => u.id !== userId));
        alert("Usuário removido com sucesso!");
      } catch (err: any) {
        console.error("Erro ao excluir usuário no Supabase:", err.message);
        alert(`Erro ao excluir: ${err.message}`);
      }
    }
  };

  const handleToggleCategory = (catId: string) => {
    if (newUserCats.includes(catId)) {
      setNewUserCats(newUserCats.filter(id => id !== catId));
    } else {
      setNewUserCats([...newUserCats, catId]);
    }
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    if (editingCategory) {
      setCategories(categories.map(c => 
        c.id === editingCategory.id ? { ...c, name: newCategoryName } : c
      ));
      setEditingCategory(null);
    } else {
      const newCat: Category = {
        id: Math.random().toString(36).substr(2, 9),
        name: newCategoryName
      };
      setCategories([...categories, newCat]);
    }

    setNewCategoryName("");
    setIsNewCategoryModalOpen(false);
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setNewCategoryName(cat.name);
    setIsNewCategoryModalOpen(true);
  };

  const handleAutoGenerateAll = () => {
    if (!isAdmin) return;
    
    // Find all future fixed events without assignments
    const futureEvents = events.filter(e => new Date(e.date) >= new Date(new Date().setHours(0,0,0,0)));
    
    if (futureEvents.length === 0) {
      alert("Nenhum evento futuro encontrado para automação. Por favor, fixe alguns dias no calendário primeiro.");
      return;
    }

    let updated = false;
    const updatedEvents = events.map(e => {
      const isFuture = new Date(e.date) >= new Date(new Date().setHours(0,0,0,0));
      if (isFuture && e.assignments.length === 0) {
        const newAssignments = generateAutoSchedule(users, categories);
        if (newAssignments.length > 0) {
          updated = true;
          return { ...e, assignments: newAssignments };
        }
      }
      return e;
    });

    if (!updated) {
      alert("Não foi possível gerar novas designações. Verifique se existem usuários vinculados às categorias disponíveis.");
      return;
    }

    setEvents(updatedEvents);
    alert("Escalas automáticas geradas com sucesso para os eventos vazios!");
  };

  const handleShareScaleWhatsApp = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const dateStr = format(new Date(event.date), "dd/MM/yyyy");
    let message = `📅 *Escala do Dia ${dateStr}:*\n`;
    if (event.name) message += `🔹 *Evento:* ${event.name}\n\n`;
    else message += `\n`;

    categories.forEach(cat => {
      const assign = event.assignments.find(a => a.categoryId === cat.id);
      const user = users.find(u => u.id === assign?.userId);
      if (user) {
        message += `🎤 *${cat.name}:* ${user.name}\n`;
      }
    });

    if (event.assignments.length === 0) {
      message += "_Nenhuma função preenchida ainda._";
    }

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank");
  };

  // --- Render Helpers ---
  if (!isClient) return null;

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-zinc-200">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-blue-600">designaIA</h1>
            <p className="text-zinc-500 mt-2">Gestão de Escalas Inteligentes</p>
          </div>

          {isRegistering ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Criar Conta</h2>
              <input
                type="text"
                placeholder="Nome Completo"
                required
                className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={regName}
                onChange={e => setRegName(e.target.value)}
              />
              <input
                type="tel"
                placeholder="Telefone"
                required
                className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={regPhone}
                onChange={e => setRegPhone(e.target.value)}
              />
              <input
                type="password"
                placeholder="Senha"
                required
                className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={regPass}
                onChange={e => setRegPass(e.target.value)}
              />
              <button className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                Cadastrar
              </button>
              <button 
                type="button"
                onClick={() => setIsRegistering(false)}
                className="w-full text-zinc-500 text-sm"
              >
                Já tenho conta? Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-zinc-900">Acesso ao Sistema</h2>
                <p className="text-sm text-zinc-500 mt-1">Insira suas credenciais para entrar</p>
              </div>
              
              {loginError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 mb-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                  {loginError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Identificação</label>
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Username ou Telefone"
                    required
                    disabled={isAuthenticating}
                    className="w-full p-3.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-zinc-50 disabled:text-zinc-400 transition-all text-sm"
                    value={loginPhone}
                    onChange={e => {
                      setLoginPhone(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Senha de Acesso</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  disabled={isAuthenticating}
                  className="w-full p-3.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-zinc-50 disabled:text-zinc-400 transition-all text-sm"
                  value={loginPass}
                  onChange={e => {
                    setLoginPass(e.target.value);
                    if (loginError) setLoginError(null);
                  }}
                />
              </div>

              <button 
                disabled={isAuthenticating}
                className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-[0.98] disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 shadow-sm"
              >
                {isAuthenticating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Validando Acesso...
                  </>
                ) : "Entrar no Sistema"}
              </button>

              <button 
                type="button"
                disabled={isAuthenticating}
                onClick={() => setIsRegistering(true)}
                className="w-full text-zinc-500 text-sm py-2 hover:text-blue-600 transition-colors disabled:opacity-50 font-medium"
              >
                Novo por aqui? <span className="text-blue-600">Criar uma conta</span>
              </button>

              <button 
                type="button"
                onClick={() => {
                  if (confirm("Deseja resetar o banco de dados local? Isso apagará todos os dados salvos neste navegador.")) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="w-full text-zinc-300 text-[10px] mt-12 hover:text-red-400 transition-colors uppercase tracking-widest font-semibold"
              >
                Limpar Cache de Dados
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const isAdmin = auth.user?.role === "ADMIN";

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-6 border-b border-zinc-100">
          <h1 className="text-2xl font-bold text-blue-600">designaIA</h1>
          <p className="text-xs text-zinc-400 uppercase tracking-widest mt-1">Versão 2.0</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
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
              <button 
                onClick={() => setActiveTab("history")}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === "history" ? "bg-blue-50 text-blue-600 font-bold" : "text-zinc-500 hover:bg-zinc-50"}`}
              >
                <Clock size={20} /> Histórico
              </button>
              <button 
                onClick={() => setActiveTab("template")}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === "template" ? "bg-blue-50 text-blue-600 font-bold" : "text-zinc-500 hover:bg-zinc-50"}`}
              >
                <Sparkles size={20} /> Configurar Template
              </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <div className="flex items-center gap-3 p-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              {auth.user?.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-900 truncate">{auth.user?.name}</p>
              <p className="text-xs text-zinc-500 uppercase">{auth.user?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut size={20} /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8">
        {/* User Alert for Assignments */}
        {!isAdmin && events.filter(e => e.assignments.some(a => a.userId === auth.user!.id && !a.confirmed)).length > 0 && (
          <div className="mb-8 space-y-4">
            {events.map(e => {
              const myAssignment = e.assignments.find(a => a.userId === auth.user!.id && !a.confirmed);
              if (!myAssignment) return null;
              const cat = categories.find(c => c.id === myAssignment.categoryId);
              return (
                <div key={e.id} className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
                  <div className="flex items-center gap-3 text-amber-800">
                    <AlertCircle size={24} />
                    <div>
                      <p className="font-bold">Você foi designado!</p>
                      <p className="text-sm">Função: <strong>{cat?.name}</strong> no dia {format(new Date(e.date), "dd/MM")}. Confirma?</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleConfirmAssignment(e.id)}
                    className="bg-amber-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-amber-700 transition-colors"
                  >
                    Confirmar Designação
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            <header className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold text-zinc-900">Dashboard</h2>
                <p className="text-zinc-500">Visão geral do sistema e suas designações</p>
              </div>
              {isAdmin && (
                <button 
                  onClick={handleAutoGenerateAll}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md active:scale-95 disabled:bg-zinc-300 disabled:shadow-none"
                  disabled={events.some(e => {
                    const now = new Date();
                    const limitDate = new Date(e.date);
                    limitDate.setDate(limitDate.getDate() + 1);
                    limitDate.setHours(23, 59, 59, 999);
                    return e.isFinalized && now <= limitDate && !e.assignments.length;
                  })}
                >
                  <Sparkles size={20} /> Designação Automática
                </button>
              )}
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Upcoming Events */}
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Clock size={20} className="text-blue-600" /> Próximas Escalas
                  </h3>
                  {isAdmin && (
                    <span className="text-xs font-medium text-zinc-400">Total de {events.filter(e => !e.isFinalized).length} escalas pendentes</span>
                  )}
                </div>
                <div className="space-y-4">
                  {events
                    .filter(e => {
                      const eventDate = new Date(e.date);
                      const now = new Date();
                      const limitDate = new Date(e.date);
                      limitDate.setDate(limitDate.getDate() + 1);
                      limitDate.setHours(23, 59, 59, 999);
                      
                      if (isAdmin) {
                        return !e.isFinalized || now <= limitDate;
                      } else {
                        return e.assignments.some(a => a.userId === auth.user?.id) && (!e.isFinalized || now <= limitDate);
                      }
                    })
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .slice(0, 5)
                    .map(e => (
                      <div key={e.id} className={`flex flex-col p-4 rounded-xl border gap-4 transition-all ${e.isFinalized ? "bg-zinc-50 border-zinc-100 opacity-90 shadow-none" : "bg-white border-zinc-200 shadow-sm"}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-zinc-900">{e.name || "Evento sem nome"}</p>
                              {e.isFinalized && <span className="text-[10px] bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Finalizada</span>}
                            </div>
                            <p className="text-sm text-zinc-500">{format(new Date(e.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
                          </div>
                          {isAdmin && (
                            <div className="flex gap-2">
                              {e.isFinalized ? (
                                <button 
                                  onClick={() => handleReopenEvent(e.id)}
                                  className="text-xs bg-zinc-600 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-700 flex items-center gap-1"
                                >
                                  <Settings size={14} /> Editar Escala
                                </button>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => handleAutoGenerate(e.id)}
                                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                                  >
                                    Gerar
                                  </button>
                                  <button 
                                    onClick={() => handleFinalizeEvent(e.id)}
                                    disabled={e.assignments.length < categories.length}
                                    className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:bg-zinc-200"
                                  >
                                    Finalizar
                                  </button>
                                </>
                              )}
                              <button 
                                onClick={() => handleShareScaleWhatsApp(e.id)}
                                className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 flex items-center gap-1"
                              >
                                <Sparkles size={14} /> Zap Geral
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {categories.map(cat => {
                            const assign = e.assignments.find(a => a.categoryId === cat.id);
                            const user = users.find(u => u.id === assign?.userId);
                            const isMissing = !assign && isAdmin && !e.isFinalized;
                            
                            return (
                              <div 
                                key={cat.id} 
                                className={`p-3 rounded-lg border flex flex-col gap-1 transition-all ${
                                  isMissing ? "bg-red-50 border-red-200" : (e.isFinalized ? "bg-white/50 border-zinc-100" : "bg-white border-zinc-100")
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isMissing ? "text-red-600" : "text-zinc-400"}`}>
                                    {cat.name}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {assign?.confirmed && (
                                      <Check size={14} className="text-green-600 font-bold" />
                                    )}
                                    {isAdmin && assign && (
                                      <button 
                                        onClick={() => handleShareIndividualWhatsApp(assign.userId, cat.id, e.date)}
                                        className="text-green-500 hover:text-green-700 p-1"
                                        title="Enviar WhatsApp Individual"
                                      >
                                        <Sparkles size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                
                                {isAdmin && !e.isFinalized ? (
                                  <select
                                    className={`text-sm bg-transparent outline-none font-medium ${isMissing ? "text-red-500" : "text-zinc-900"}`}
                                    value={assign?.userId || ""}
                                    onChange={(ev) => handleManualEditAssignment(e.id, cat.id, ev.target.value)}
                                  >
                                    <option value="">{isMissing ? "⚠️ SELECIONE" : "Vago"}</option>
                                    {users
                                      .filter(u => u.linkedCategories.includes(cat.id))
                                      .map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                      ))
                                    }
                                  </select>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <span className={`text-sm font-medium ${user ? "text-zinc-900" : "text-zinc-400 italic"}`}>
                                      {user ? user.name : "Vago"}
                                    </span>
                                    {user?.id === auth.user?.id && !assign?.confirmed && (
                                      <button 
                                        onClick={() => handleConfirmAssignment(e.id)}
                                        className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 shadow-sm"
                                      >
                                        Confirmar
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  {events.length === 0 && <p className="text-center text-zinc-400 py-8">Nenhum evento fixado no calendário.</p>}
                </div>
              </section>

              {/* User Stats Card */}
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 h-fit">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Users size={20} className="text-blue-600" /> Seu Histórico
                </h3>
                <div className="space-y-6">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-zinc-500 text-sm">Participações</p>
                      <p className="text-4xl font-black text-zinc-900">{auth.user?.historyCount}/{auth.user?.totalEvents}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-zinc-500 text-sm">Frequência</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {auth.user && auth.user.totalEvents > 0 
                          ? ((auth.user.historyCount / auth.user.totalEvents) * 100).toFixed(0) 
                          : 0}%
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-1000" 
                      style={{ width: `${auth.user && auth.user.totalEvents > 0 ? (auth.user.historyCount / auth.user.totalEvents) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-xs text-zinc-500 uppercase font-bold">Última Vez</p>
                      <p className="text-sm font-bold text-zinc-900 mt-1">
                        {auth.user?.lastParticipation ? format(new Date(auth.user.lastParticipation), "dd/MM/yyyy") : "Nunca"}
                      </p>
                    </div>
                    <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-xs text-zinc-500 uppercase font-bold">Categorias</p>
                      <p className="text-sm font-bold text-zinc-900 mt-1">{auth.user?.linkedCategories.length || 0} vinculadas</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="space-y-8">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-zinc-900">Calendário</h2>
                <p className="text-zinc-500">Fixe datas para escalas {isAdmin && "(clique no dia para fixar)"}</p>
              </div>
              <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-zinc-200">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-zinc-100 rounded-lg"><ChevronLeft size={20} /></button>
                <span className="font-bold text-zinc-900 min-w-[150px] text-center capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </span>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-zinc-100 rounded-lg"><ChevronRight size={20} /></button>
              </div>
            </header>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
              <div className="grid grid-cols-7 gap-px bg-zinc-100 rounded-xl overflow-hidden border border-zinc-100">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                  <div key={d} className="bg-zinc-50 p-4 text-center text-xs font-bold text-zinc-400 uppercase tracking-widest">{d}</div>
                ))}
                {eachDayOfInterval({
                  start: startOfMonth(currentMonth),
                  end: endOfMonth(currentMonth)
                }).map((day, i) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const event = events.find(e => e.date === dateStr);
                  const isPast = day < new Date(new Date().setHours(0,0,0,0));
                  
                  return (
                    <div 
                      key={dateStr}
                      onClick={() => !isPast && toggleDayFixed(day)}
                      className={`min-h-[120px] bg-white p-4 transition-all relative cursor-pointer group ${
                        i % 7 === 0 || i % 7 === 6 ? "bg-zinc-50/50" : ""
                      } ${!isPast && isAdmin ? "hover:bg-blue-50/50" : ""}`}
                    >
                      <span className={`text-sm font-bold ${isToday(day) ? "bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-full" : isPast ? "text-zinc-300" : "text-zinc-900"}`}>
                        {format(day, "d")}
                      </span>

                      {event && (
                        <div className="mt-2 space-y-1">
                          {isAdmin ? (
                            <>
                              <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                event.assignments.length === categories.length 
                                  ? "bg-green-100 text-green-700" 
                                  : "bg-amber-100 text-amber-700"
                              }`}>
                                {event.assignments.length === categories.length ? "Completa" : `${event.assignments.length}/${categories.length} Vagas`}
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleShareScaleWhatsApp(event.id); }}
                                className="text-xs bg-green-500 text-white px-2 py-1 rounded-lg hover:bg-green-600"
                              >
                                Zap
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleAutoGenerate(event.id); }}
                                className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg hover:bg-blue-700"
                              >
                                Gerar
                              </button>
                              {event.assignments.slice(0, 2).map(a => {
                                const u = users.find(u => u.id === a.userId);
                                return (
                                  <div key={a.categoryId} className="text-[10px] text-zinc-500 truncate flex items-center gap-1 w-full">
                                    {a.confirmed ? <Check size={10} className="text-green-500" /> : <Clock size={10} className="text-zinc-400" />}
                                    {a.assignedBy === 'auto' && <Sparkles size={10} className="text-blue-400" />}
                                    <span className="truncate">{u?.name} <span className="text-[8px] text-zinc-400">({u?.historyCount}/{u?.totalEvents})</span></span>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleRemoveAssignment(event.id, a.userId); }}
                                      className="ml-auto text-red-400 hover:text-red-600 p-1 -mr-1 flex-shrink-0"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                );
                              })}
                              {event.assignments.length > 2 && (
                                <div className="text-[10px] text-zinc-400 italic">+{event.assignments.length - 2} mais...</div>
                              )}
                            </>
                          ) : (
                            <>
                              {event.assignments
                                .filter(a => a.userId === auth.user?.id)
                                .map(myAssignment => {
                                  const cat = categories.find(c => c.id === myAssignment.categoryId);
                                  return (
                                     <div key={myAssignment.categoryId} className="bg-blue-100 text-blue-800 text-[10px] font-bold p-1 rounded-md flex flex-col gap-0.5 w-full">
                                       <div className="flex items-center gap-1">
                                         {myAssignment.confirmed ? <Check size={10} /> : <Clock size={10} />}
                                         <span className="truncate">{cat?.name}</span>
                                       </div>
                                       <span className="text-[8px] font-normal opacity-70">Sua Frequência: {auth.user?.historyCount}/{auth.user?.totalEvents}</span>
                                     </div>
                                  );
                                })
                              }
                            </>
                          )}
                        </div>
                      )}
                      
                      {!event && !isPast && isAdmin && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus size={24} className="text-blue-200" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "users" && isAdmin && (
          <div className="space-y-8">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-zinc-900">Usuários</h2>
                <p className="text-zinc-500">Gerencie permissões e vínculos</p>
              </div>
              <div className="flex items-center gap-4">
                <select 
                  onChange={(e) => setUserFilter(e.target.value || null)}
                  className="bg-white border border-zinc-200 rounded-xl p-2 text-sm"
                >
                  <option value="">Filtrar por Categoria</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button 
                  onClick={() => {
                    setEditingUser(null);
                    setNewUserName("");
                    setNewUserPhone("");
                    setNewUserPass("");
                    setNewUserRole("USER");
                    setNewUserCats([]);
                    setIsNewUserModalOpen(true);
                  }}
                  className="bg-blue-600 text-white font-bold p-3 rounded-xl flex items-center gap-2 hover:bg-blue-700 shadow-md transition-all active:scale-95"
                >
                  <Plus size={16} /> Novo Usuário
                </button>
              </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="p-4 font-bold text-zinc-600 text-sm">Nome</th>
                    <th className="p-4 font-bold text-zinc-600 text-sm">Perfil</th>
                    <th className="p-4 font-bold text-zinc-600 text-sm">Categorias</th>
                    <th className="p-4 font-bold text-zinc-600 text-sm">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {users
                    .filter(u => !userFilter || u.linkedCategories.includes(userFilter))
                    .map(user => (
                    <tr key={user.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-zinc-900">{user.name}</p>
                        <p className="text-xs text-zinc-500">{user.phone}</p>
                      </td>
                      <td className="p-4">
                        <select 
                          value={user.role}
                          onChange={async (e) => {
                            const newRole = e.target.value as UserRole;
                            try {
                              if (isSupabaseConfigured()) {
                                const { error } = await supabase
                                  .from('perfis')
                                  .update({ role: newRole })
                                  .eq('id', user.id);
                                if (error) throw error;
                              }
                              setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u));
                            } catch (err: any) {
                              console.error("Erro ao atualizar perfil do usuário:", err.message);
                            }
                          }}
                          className="text-xs font-bold p-1 rounded bg-zinc-100 outline-none"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="USER">USER</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {categories.map(cat => (
                            <button
                              key={cat.id}
                              onClick={async () => {
                                const linked = user.linkedCategories.includes(cat.id);
                                const newList = linked 
                                  ? user.linkedCategories.filter(id => id !== cat.id)
                                  : [...user.linkedCategories, cat.id];
                                
                                try {
                                  if (isSupabaseConfigured()) {
                                    const { error } = await supabase
                                      .from('perfis')
                                      .update({ linked_categories: newList })
                                      .eq('id', user.id);
                                    if (error) throw error;
                                  }
                                  setUsers(users.map(u => u.id === user.id ? { ...u, linkedCategories: newList } : u));
                                } catch (err: any) {
                                  console.error("Erro ao atualizar categoria do usuário:", err.message);
                                }
                              }}
                              className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                                user.linkedCategories.includes(cat.id)
                                  ? "bg-blue-600 border-blue-600 text-white"
                                  : "border-zinc-200 text-zinc-400 hover:border-blue-200"
                              }`}
                            >
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEditUser(user)}
                            className="text-zinc-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Editar Usuário"
                          >
                            <Settings size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-zinc-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="Excluir Usuário"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "categories" && isAdmin && (
          <div className="space-y-8">
            <header className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold text-zinc-900">Categorias</h2>
                <p className="text-zinc-500">Defina as funções disponíveis para escala</p>
              </div>
              <button 
                onClick={() => {
                  setEditingCategory(null);
                  setNewCategoryName("");
                  setIsNewCategoryModalOpen(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700"
              >
                <Plus size={20} /> Nova Categoria
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map(cat => (
                <div key={cat.id} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 flex items-center justify-between">
                  <span className="font-bold text-zinc-900">{cat.name}</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEditCategory(cat)}
                      className="text-zinc-400 hover:text-blue-600 p-2"
                    >
                      <Settings size={18} />
                    </button>
                    <button 
                      onClick={() => setCategories(categories.filter(c => c.id !== cat.id))}
                      className="text-zinc-400 hover:text-red-600 p-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
      )}

      {activeTab === "history" && isAdmin && (
          <div className="space-y-8">
            <header className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold text-zinc-900">Histórico de Escalas</h2>
                <p className="text-zinc-500">Consulte escalas finalizadas por período</p>
              </div>
            </header>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Data Início</label>
                <input 
                  type="date" 
                  value={historyStart}
                  onChange={(e) => setHistoryStart(e.target.value)}
                  className="w-full p-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Data Fim</label>
                <input 
                  type="date" 
                  value={historyEnd}
                  onChange={(e) => setHistoryEnd(e.target.value)}
                  className="w-full p-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button 
                onClick={() => { setHistoryStart(""); setHistoryEnd(""); }}
                className="p-2 text-zinc-500 hover:text-blue-600 text-sm font-medium"
              >
                Limpar Filtros
              </button>
            </div>

            <div className="space-y-4">
              {events
                .filter(e => e.isFinalized)
                .filter(e => !historyStart || e.date >= historyStart)
                .filter(e => !historyEnd || e.date <= historyEnd)
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(e => (
                  <div key={e.id} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-lg text-zinc-900">{e.name || "Evento sem nome"}</h4>
                        <p className="text-sm text-zinc-500">{format(new Date(e.date), "dd/MM/yyyy")}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleShareScaleWhatsApp(e.id)}
                          className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600"
                        >
                          WhatsApp
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {categories.map(cat => {
                        const assign = e.assignments.find(a => a.categoryId === cat.id);
                        const user = users.find(u => u.id === assign?.userId);
                        return (
                          <div key={cat.id} className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">{cat.name}</p>
                            <p className="text-sm font-medium text-zinc-700 truncate">{user?.name || "Vago"}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              {events.filter(e => e.isFinalized).length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200 border-dashed">
                  <Clock size={48} className="mx-auto text-zinc-200 mb-2" />
                  <p className="text-zinc-400 font-medium">Nenhuma escala finalizada no histórico.</p>
                </div>
              )}
            </div>
          </div>
      )}

      {activeTab === "template" && isAdmin && (
        <div className="space-y-8">
          <header>
            <h2 className="text-3xl font-bold text-zinc-900">Template de Mensagem</h2>
            <p className="text-zinc-500">Personalize a mensagem enviada aos voluntários via WhatsApp</p>
          </header>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 uppercase tracking-wider">Sua Mensagem Padrão</label>
              <textarea 
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                className="w-full min-h-[150px] p-4 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none font-medium text-zinc-700"
                placeholder="Escreva seu template aqui..."
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <h4 className="text-sm font-bold text-blue-800 mb-2 uppercase tracking-widest">Variáveis Disponíveis</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li><code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-bold">{"{{nome}}"}</code> - Nome completo do voluntário</li>
                <li><code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-bold">{"{{funcao}}"}</code> - Nome da categoria/função</li>
                <li><code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-bold">{"{{data}}"}</code> - Data do evento formatada (dd/mm/aaaa)</li>
              </ul>
            </div>

            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
              <h4 className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest">Exemplo de Visualização</h4>
              <p className="text-sm text-zinc-600 italic">
                {whatsappTemplate
                  .replace("{{nome}}", "João Silva")
                  .replace("{{funcao}}", "Áudio")
                  .replace("{{data}}", format(new Date(), "dd/MM/yyyy"))}
              </p>
            </div>

            <button 
              onClick={() => alert("Template salvo automaticamente!")}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95"
            >
              Salvar Template
            </button>
          </div>
        </div>
      )}

      {/* Event Creation/Edition Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-zinc-200">
            <form onSubmit={handleSaveEvent} className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-zinc-900">
                  {editingEvent ? "Editar Evento" : "Novo Evento"}
                </h2>
                <button 
                  type="button" 
                  onClick={() => setIsEventModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Data do Evento</label>
                  <input
                    type="date"
                    required
                    className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Nome do Evento</label>
                  <input
                    type="text"
                    placeholder="Ex: Culto de Domingo"
                    required
                    className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={eventName}
                    onChange={e => setEventName(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                {editingEvent && (
                  <button 
                    type="button"
                    onClick={() => handleDeleteEvent(editingEvent.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1"
                  >
                    <Trash2 size={16} /> Excluir Evento
                  </button>
                )}
                <div className="flex gap-4 ml-auto">
                  <button 
                    type="button"
                    onClick={() => setIsEventModalOpen(false)}
                    className="px-6 py-2 rounded-lg font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg active:scale-95"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {isNewCategoryModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-zinc-200">
            <form onSubmit={handleCreateCategory} className="p-8 space-y-6">
              <h2 className="text-2xl font-bold text-zinc-900">
                {editingCategory ? "Editar Categoria" : "Nova Categoria"}
              </h2>
              
              <input
                type="text"
                placeholder="Nome da Categoria"
                required
                className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                autoFocus
              />

              <div className="flex justify-end gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsNewCategoryModalOpen(false)}
                  className="px-6 py-2 rounded-lg font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New User Modal */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-zinc-200 my-8">
            <form onSubmit={handleCreateUser} className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-zinc-900">
                  {editingUser ? "Editar Usuário" : "Criar Novo Usuário"}
                </h2>
                <button 
                  type="button" 
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Nome Completo</label>
                  <input
                    type="text"
                    placeholder="Ex: João Silva"
                    required
                    className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newUserName}
                    onChange={e => setNewUserName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Telefone</label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    required
                    className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newUserPhone}
                    onChange={e => setNewUserPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Senha {editingUser && "(deixe em branco para manter)"}</label>
                  <input
                    type="password"
                    placeholder={editingUser ? "••••••••" : "Senha padrão: designa123"}
                    className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newUserPass}
                    onChange={e => setNewUserPass(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Perfil de Acesso</label>
                  <select
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value as UserRole)}
                    className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="USER">Usuário Comum</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Vincular Habilidades (Categorias)</h3>
                <div className="grid grid-cols-2 gap-2 p-4 rounded-lg bg-zinc-50 border border-zinc-100 max-h-40 overflow-y-auto">
                  {categories.map(cat => (
                    <label key={cat.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-zinc-200">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={newUserCats.includes(cat.id)}
                        onChange={() => {
                          if (newUserCats.includes(cat.id)) {
                            setNewUserCats(newUserCats.filter(id => id !== cat.id));
                          } else {
                            setNewUserCats([...newUserCats, cat.id]);
                          }
                        }}
                      />
                      <span className="text-sm font-medium text-zinc-700">{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-zinc-100">
                <button 
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="px-6 py-2 rounded-lg font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg active:scale-95"
                >
                  {editingUser ? "Salvar Alterações" : "Criar Usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal for New User */}
      {lastCreatedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-zinc-900">Usuário Criado!</h2>
            <p className="text-zinc-500 mt-2">O que você gostaria de fazer agora?</p>
            
            <div className="mt-6 space-y-3">
              <button
                onClick={() => {
                  const message = `Olá, ${lastCreatedUser.name}! Você foi cadastrado no designaIA. Suas credenciais são:\n🔗 Link: ${window.location.origin}\n📱 Usuário: ${lastCreatedUser.phone}\n🔑 Senha: ${lastCreatedUser.password}\nPor favor, acesse para confirmar suas próximas designações.`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank");
                }}
                className="w-full bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <img src="/whatsapp.svg" alt="WhatsApp" className="w-5 h-5"/> Enviar Acesso via WhatsApp
              </button>
              <button 
                type="button"
                onClick={() => setLastCreatedUser(null)}
                className="w-full px-6 py-2 rounded-lg font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      </main>
    </div>
  );
}
