// supabase/functions/manage_credits/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, PostgrestError } from "https://esm.sh/@supabase/supabase-js@2";

// --- Supabase client ---
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);

// --- Types ---
interface UserCredits {
  user_id: string;
  current_credits: number;
  last_credit_award_time: string;
  daily_credit_reset_time: string;
  daily_recovered_credits: number; // NEW field
}

interface RequestBody {
  user_id?: string;
  amount?: number;
}

// --- JSON response helper ---
function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- Helper: Ensure user row exists ---
async function ensureUser(userId: string): Promise<UserCredits> {
  const { data, error } = await supabase
    .from("user_credits")
    .select("*")
    .eq("user_id", userId)
    .single<UserCredits>();

  if (error && (error as PostgrestError).code !== "PGRST116") throw error;

  if (!data) {
    const now = new Date().toISOString();
    const { data: newUser, error: insertError } = await supabase
      .from("user_credits")
      .insert({
        user_id: userId,
        current_credits: 4,
        last_credit_award_time: now,
        daily_credit_reset_time: now,
        daily_recovered_credits: 0,
      })
      .select()
      .single<UserCredits>();

    if (insertError) throw insertError;
    return newUser as UserCredits;
  }

  return data;
}

// --- Helper: Recover credits with cap ---
function recoverCredits(userRow: UserCredits): UserCredits {
  let {
    current_credits,
    last_credit_award_time,
    daily_credit_reset_time,
    daily_recovered_credits,
  } = userRow;

  const now = new Date();

  // --- Midnight reset ---
  const lastReset = new Date(daily_credit_reset_time);
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  if (lastReset < todayMidnight) {
    current_credits = 4;
    daily_credit_reset_time = now.toISOString();
    daily_recovered_credits = 0; // reset daily recovery tracker
  }

  // --- Add 1 credit/hour (up to 4 recovered/day) ---
  if (current_credits < 8 && daily_recovered_credits < 4) {
    const lastAward = new Date(last_credit_award_time);
    const diffHours = Math.floor(
      (now.getTime() - lastAward.getTime()) / (1000 * 60 * 60)
    );

    if (diffHours >= 1) {
      const possibleToAdd = Math.min(diffHours, 8 - current_credits);
      const remainingDaily = 4 - daily_recovered_credits;
      const creditsToAdd = Math.min(possibleToAdd, remainingDaily);

      if (creditsToAdd > 0) {
        current_credits += creditsToAdd;
        daily_recovered_credits += creditsToAdd;
        last_credit_award_time = now.toISOString();
      }
    }
  }

  return {
    user_id: userRow.user_id,
    current_credits,
    last_credit_award_time,
    daily_credit_reset_time,
    daily_recovered_credits,
  };
}

// --- Handlers ---
async function handleGetCredits(userId: string): Promise<UserCredits> {
  let userRow = await ensureUser(userId);
  const recovered = recoverCredits(userRow);

  const { data, error } = await supabase
    .from("user_credits")
    .update(recovered)
    .eq("user_id", userId)
    .select()
    .single<UserCredits>();

  if (error) throw error;
  return data as UserCredits;
}

async function handleUseCredits(userId: string, amount: number = 2): Promise<UserCredits> {
  let userRow = await handleGetCredits(userId);

  if (userRow.current_credits < amount) {
    throw new Error(`Not enough credits. Need ${amount}, have ${userRow.current_credits}`);
  }

  const { data, error } = await supabase
    .from("user_credits")
    .update({ current_credits: userRow.current_credits - amount })
    .eq("user_id", userId)
    .select()
    .single<UserCredits>();

  if (error) throw error;
  return data as UserCredits;
}

async function handleResetCredits(userId: string): Promise<UserCredits> {
  const resetData = {
    current_credits: 4,
    daily_credit_reset_time: new Date().toISOString(),
    last_credit_award_time: new Date().toISOString(),
    daily_recovered_credits: 0,
  };

  const { data, error } = await supabase
    .from("user_credits")
    .update(resetData)
    .eq("user_id", userId)
    .select()
    .single<UserCredits>();

  if (error) throw error;
  return data as UserCredits;
}

// --- Main Router ---
serve(async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);
  const body: RequestBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const userId = body.user_id || req.headers.get("x-user-id") || "";

  if (!userId) {
    return jsonResponse({ error: "Missing user_id" }, 400);
  }

  try {
    switch (true) {
      case pathname === "/credits" && req.method === "GET":
        return jsonResponse(await handleGetCredits(userId));

      case pathname === "/credits/use" && req.method === "POST":
        return jsonResponse(await handleUseCredits(userId, body.amount ?? 2));

      case pathname === "/credits/reset" && req.method === "POST":
        return jsonResponse(await handleResetCredits(userId));

      default:
        return jsonResponse({ error: "Not found" }, 404);
    }
  } catch (err: any) {
    console.error("Credit error:", err.message);
    return jsonResponse({ error: err.message }, 400);
  }
});
