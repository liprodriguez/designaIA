import { createClient } from '@supabase/supabase-js';

// Usamos valores placeholder para evitar erro de build caso as variáveis não estejam no .env local
// O código no page.tsx já verifica a existência das variáveis reais antes de usar o cliente.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
