import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import type { Database } from '@/types/database';

/**
 * Cliente de Supabase para Falta Uno.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 👉 PEGÁ ACÁ TUS CREDENCIALES REALES
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Andá a https://supabase.com/dashboard → tu proyecto → Settings → API
 * 2. Copiá el "Project URL" y la "anon public" key.
 * 3. Lo ideal es ponerlas en un archivo `.env` (ver `.env.example`) y leerlas con
 *    `process.env.EXPO_PUBLIC_SUPABASE_URL`. Acá dejamos un fallback de ejemplo.
 *
 * ⚠️ La `anon key` es pública (segura para el cliente). NUNCA pongas la
 *    `service_role` key en la app.
 */
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://TU-PROYECTO.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'TU_ANON_KEY_AQUI';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Guardamos la sesión en el almacenamiento del dispositivo
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // En React Native no hay URL de redirección que detectar
    detectSessionInUrl: false,
  },
});

/** `true` cuando todavía no se configuraron credenciales reales. */
export const supabaseConfigurado =
  !SUPABASE_URL.includes('TU-PROYECTO') && SUPABASE_ANON_KEY !== 'TU_ANON_KEY_AQUI';
