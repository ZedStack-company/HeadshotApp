// supabase/functions/manage_credits/index.js
import { serve } from "http";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_ANON_KEY")
);

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- Helper: Ensure user row exists ---
async function ensureUser(userId) {
  const { data, error } = await supabase
    .from("user_credits")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // 116 = no rows
  if (!data) {
    // create with default credits
    const { data: newUser, error: insertError } = await supabase
      .from("user_credits")
      .insert({
        user_id: userId,
        current_credits: 4,
        last_credit_award_time: new Date().toISOString(),
        daily_credit_reset_time: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return newUser;
  }
  return data;
}

// --- Helper: Recover credits (hourly + midnight reset) ---
function recoverCredits(userRow) {
  let { current_credits, last_credit_award_time, daily_credit_reset_time } = userRow;
  const now = new Date();

  // --- Reset at midnight (give 4 credits)
  const lastReset = new Date(daily_credit_reset_time);
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  if (lastReset < todayMidnight) {
    current_credits = 4;
    daily_credit_reset_time = now.toISOString();
  }

  // --- Add 1 credit/hour if < 8
  if (current_credits < 8) {
    const lastAward = new Date(last_credit_award_time);
    const diffHours = Math.floor((now - lastAward) / (1000 * 60 * 60));
    if (diffHours >= 1) {
      const creditsToAdd = Math.min(diffHours, 8 - current_credits);
      current_credits += creditsToAdd;
      last_credit_award_time = now.toISOString();
    }
  }

  return { current_credits, last_credit_award_time, daily_credit_reset_time };
}

// --- Handlers ---
async function handleGetCredits(userId) {
  let userRow = await ensureUser(userId);

  // Recover before returning
  const recovered = recoverCredits(userRow);

  // update db
  const { data, error } = await supabase
    .from("user_credits")
    .update(recovered)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function handleUseCredits(userId, amount = 2) {
  let userRow = await handleGetCredits(userId); // auto-recover first

  if (userRow.current_credits < amount) {
    throw new Error(`Not enough credits. Need ${amount}, have ${userRow.current_credits}`);
  }

  const { data, error } = await supabase
    .from("user_credits")
    .update({ current_credits: userRow.current_credits - amount })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function handleResetCredits(userId) {
  const resetData = {
    current_credits: 4,
    daily_credit_reset_time: new Date().toISOString(),
    last_credit_award_time: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_credits")
    .update(resetData)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- Main router ---
serve(async (req) => {
  const { pathname } = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const userId = body.user_id || req.headers.get("x-user-id"); // ✅ You decide auth strategy

  if (!userId) {
    return jsonResponse({ error: "Missing user_id" }, 400);
  }

  try {
    switch (true) {
      case pathname === "/credits" && req.method === "GET":
        return jsonResponse(await handleGetCredits(userId));

      case pathname === "/credits/use" && req.method === "POST":
        return jsonResponse(await handleUseCredits(userId, body.amount || 2));

      case pathname === "/credits/reset" && req.method === "POST":
        return jsonResponse(await handleResetCredits(userId));

      default:
        return jsonResponse({ error: "Not found" }, 404);
    }
  } catch (err) {
    console.error("Credit error:", err.message);
    return jsonResponse({ error: err.message }, 400);
  }
});
