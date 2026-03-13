import { createClient } from '@supabase/supabase-js';

// Valores extraídos das suas variáveis de ambiente ou inseridos diretamente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://djunuewwlzttyxvtitie.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ArD1cIRTEcBjWGt7ZN1TMA_YO2PRPvh';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
