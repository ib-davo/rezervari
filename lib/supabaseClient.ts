"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Client browser DOAR pentru Realtime (push instant când Booking se schimbă).
// Citirea efectivă a datelor se face prin /api/operator/bookings (gated cu sesiune).
// Necesită NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.
// Dacă lipsesc, returnează null → dashboard-ul cade pe polling.

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || key.startsWith("PLACEHOLDER")) {
    client = null;
    return client;
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
