import { useState } from "react";
import { supabase } from "../supabaseClient";

// NOTE: This is intentionally low-security — usernames are public and the
// internal password is shared. Fine for personal use; do not store sensitive data.
// Each unique username maps to its own Supabase account and data is isolated per user.
const INTERNAL_DOMAIN = "jobhub.app";
const INTERNAL_PASS   = "jobhub-access-2024";

function toEmail(username) {
  return `${username.toLowerCase().trim()}@${INTERNAL_DOMAIN}`;
}

export default function AuthScreen() {
  const [username, setUsername] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function handleAccess() {
    const name = username.trim();
    if (!name) { setError("Please enter a username."); return; }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      setError("Username can only contain letters, numbers, _ and -");
      return;
    }

    setLoading(true); setError("");
    const email = toEmail(name);

    // Try signing in first
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: INTERNAL_PASS,
    });

    if (!signInErr) { setLoading(false); return; } // success

    // If user doesn't exist yet, create the account then sign in
    if (signInErr.message.toLowerCase().includes("invalid login")) {
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password: INTERNAL_PASS,
      });
      if (signUpErr) {
        setError("Could not create account: " + signUpErr.message);
        setLoading(false); return;
      }
      // Sign in immediately after sign up
      const { error: retryErr } = await supabase.auth.signInWithPassword({
        email,
        password: INTERNAL_PASS,
      });
      if (retryErr) setError("Account created but sign-in failed. Try again.");
    } else {
      setError(signInErr.message);
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-indigo-600">JobHub</span>
          <p className="text-sm text-gray-500 mt-1">Track your job applications from anywhere</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              autoFocus
              autoComplete="off"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="e.g. aamir"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAccess()}
              disabled={loading}
            />
            <p className="text-xs text-gray-400 mt-1">Letters, numbers, _ and - only. Same username = same account.</p>
          </div>

          {error && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleAccess}
            disabled={loading}
            className="w-full py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 min-h-[44px]"
          >
            {loading ? "Signing in…" : "Go to my tracker"}
          </button>
        </div>
      </div>
    </div>
  );
}
