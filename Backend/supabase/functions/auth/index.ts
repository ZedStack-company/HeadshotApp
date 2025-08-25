// supabase/functions/auth/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

type User = {
  id: string;
  email?: string;
  // Add other user properties as needed
};

type Session = {
  access_token: string;
  refresh_token: string;
  // Add other session properties as needed
};

// --- Initialize Supabase client ---
const supabase = createClient(
  "https://nbepmasgfnqojtzmiprd.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iZXBtYXNnZm5xb2p0em1pcHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwMTc2NzIsImV4cCI6MjA3MTU5MzY3Mn0.zQjdc0qBmBFQQA33zWkTDeugI8iYtDYtyDg5EntJgfgs"
);

// --- Utility: JSON response helper ---
function jsonResponse(data: unknown, status: number = 200): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

// --- Types ---
interface AuthBody {
  email?: string;
  password?: string;
}

// --- Handlers ---
async function handleSignup(body: AuthBody): Promise<{ user: User | null }> {
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

async function handleLogin(body: AuthBody): Promise<{ user: User | null; session: Session | null }> {
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

async function handleGoogleLogin(): Promise<{ url: string | null }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: "http://localhost:3000/auth/callback" }, // ⚠️ Update for production
  });

  if (error) throw error;
  return { url: data?.url ?? null };
}

async function handleLogout(): Promise<{ message: string }> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return { message: "Logged out successfully" };
}

// --- Main router ---
serve(async (req: Request): Promise<Response> => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const { pathname } = new URL(req.url);
  const body: AuthBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};

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
  } catch (err: any) {
    console.error("Auth error:", err.message);
    return jsonResponse({ error: err.message }, 400);
  }
});
