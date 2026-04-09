import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignIn() {
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true); setError(""); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function handleSignUp() {
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true); setError(""); setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    else setMessage("Account created! Check your email to confirm your account before signing in.");
    setLoading(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSignIn();
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-indigo-600">JobHub</span>
          <p className="text-sm text-gray-500 mt-1">Track your job applications from anywhere</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          {message && (
            <div className="px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {message}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 min-h-[44px]"
            >
              {loading ? "..." : "Sign In"}
            </button>
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-60 min-h-[44px]"
            >
              {loading ? "..." : "Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
