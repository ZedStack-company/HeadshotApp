// supabase/functions/auth/index.js
import { serve } from "http";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_ANON_KEY")
);

// --- Utility: JSON response helper
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- Handlers ---
async function handleSignup(body) {
  if (!body.email || !body.password) {
    throw new Error("Email and password are required");
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
  });
  if (error) throw error;
  return { user: data.user };
}

async function handleLogin(body) {
  if (!body.email || !body.password) {
    throw new Error("Email and password are required");
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });
  if (error) throw error;
  return { user: data.user, session: data.session };
}

async function handleGoogleLogin() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: "http://localhost:3000/auth/callback" }, // ⚠️ Update for prod
  });
  if (error) throw error;
  return { url: data.url };
}

async function handleLogout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return { message: "Logged out successfully" };
}

// --- Main router ---
serve(async (req) => {
  const { pathname } = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  try {
    switch (true) {
      case pathname === "/signup" && req.method === "POST":
        return jsonResponse(await handleSignup(body));

      case pathname === "/login" && req.method === "POST":
        return jsonResponse(await handleLogin(body));

      case pathname === "/login/google" && req.method === "GET":
        return jsonResponse(await handleGoogleLogin());

      case pathname === "/logout" && req.method === "POST":
        return jsonResponse(await handleLogout());

      default:
        return jsonResponse({ error: "Not found" }, 404);
    }
  } catch (err) {
    console.error("Auth error:", err.message);
    return jsonResponse({ error: err.message }, 400);
  }
});
