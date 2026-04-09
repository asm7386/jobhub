import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { jobFromDB, linkFromDB, profileFromDB } from "./utils/db";
import AuthScreen from "./pages/AuthScreen";
import Tracker from "./pages/Tracker";
import Reminders from "./pages/Reminders";
import ProfileHub from "./pages/ProfileHub";

// ─── Nav definition ───────────────────────────────────────────────────────────

const NAV = [
  {
    id: "tracker",
    label: "Tracker",
    icon: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="9" x2="9" y2="21" />
      </svg>
    ),
  },
  {
    id: "reminders",
    label: "Reminders",
    icon: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Profile Hub",
    icon: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

const SignOutIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

// ─── Default links seeded for new users ───────────────────────────────────────

const DEFAULT_LINKS = [
  { label: "LinkedIn",  url: "https://linkedin.com/in/yourname", subtitle: "linkedin.com/in/yourname", color: "bg-blue-500",   no_url: false, sort_order: 0 },
  { label: "GitHub",    url: "https://github.com/yourname",      subtitle: "github.com/yourname",      color: "bg-gray-700",   no_url: false, sort_order: 1 },
  { label: "Portfolio", url: "https://yoursite.dev",             subtitle: "yoursite.dev",             color: "bg-purple-500", no_url: false, sort_order: 2 },
  { label: "Resume",    url: "",                                 subtitle: "v1 — Mar 2026",            color: "bg-orange-500", no_url: true,  sort_order: 3 },
  { label: "Email",     url: "mailto:your@email.com",            subtitle: "your@email.com",           color: "bg-green-500",  no_url: false, sort_order: 4 },
];

const EMPTY_PROFILE = { name: "", title: "", bio: "", linkedin: "", github: "", portfolio: "", skills: "" };

// ─── Loading spinner ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession]               = useState(undefined); // undefined = not yet checked
  const [page, setPage]                     = useState("tracker");
  // null = not yet loaded from Supabase; array = loaded (may be empty)
  const [jobs, setJobs]                     = useState(null);
  const [links, setLinks]                   = useState(null);
  const [profile, setProfile]               = useState(EMPTY_PROFILE);
  const [dataError, setDataError]           = useState("");
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);

  // ── Auth listener ──────────────────────────────────────────────────────────

  useEffect(() => {
    // Get current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
    });

    // Subscribe to future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch data whenever the logged-in user changes ─────────────────────────

  useEffect(() => {
    if (session === undefined) return; // still checking auth — wait
    if (!session) {
      // Signed out: clear everything
      setJobs(null);
      setLinks(null);
      setProfile(EMPTY_PROFILE);
      setShowMigrationBanner(false);
      return;
    }
    fetchAllData(session.user.id);
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAllData(userId) {
    setJobs(null);   // null triggers the loading spinner
    setLinks(null);
    setDataError("");

    try {
      const [jobsRes, linksRes, profileRes] = await Promise.all([
        supabase.from("jobs").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("links").select("*").eq("user_id", userId).order("sort_order"),
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (linksRes.error) throw linksRes.error;
      // profileRes error is allowed (user may not have a profile row yet)

      const fetchedJobs = (jobsRes.data || []).map(jobFromDB);
      setJobs(fetchedJobs);

      // Check if local-storage data should be migrated
      if (fetchedJobs.length === 0) {
        try {
          const raw = localStorage.getItem("jobhub_jobs");
          if (raw) {
            const local = JSON.parse(raw);
            if (Array.isArray(local) && local.length > 0) setShowMigrationBanner(true);
          }
        } catch { /* ignore corrupt localStorage */ }
      }

      // Seed five default links for brand-new users
      if (!linksRes.data || linksRes.data.length === 0) {
        const rows = DEFAULT_LINKS.map((l) => ({ ...l, user_id: userId }));
        const { data: seeded } = await supabase.from("links").insert(rows).select();
        setLinks((seeded || []).map(linkFromDB));
      } else {
        setLinks(linksRes.data.map(linkFromDB));
      }

      setProfile(profileRes.data ? profileFromDB(profileRes.data) : EMPTY_PROFILE);

    } catch (err) {
      setDataError("Failed to load your data: " + (err.message || "Unknown error"));
      // Still set empty arrays so the UI renders rather than staying on spinner
      setJobs([]);
      setLinks([]);
    }
  }

  // ── Local-storage migration ────────────────────────────────────────────────

  async function handleMigrationImport() {
    try {
      const raw = localStorage.getItem("jobhub_jobs");
      if (!raw || !session) { setShowMigrationBanner(false); return; }
      const localJobs = JSON.parse(raw);
      if (!Array.isArray(localJobs) || localJobs.length === 0) { setShowMigrationBanner(false); return; }

      const now = new Date().toISOString();
      const rows = localJobs.map((j) => ({
        user_id: session.user.id,
        company: j.company || "",
        role: j.role || "",
        date_applied: j.dateApplied || null,
        status: j.status || "Applied",
        source: j.source || "",
        category: j.category || "SWE",
        notes: j.notes || "",
        job_url: j.jobUrl || "",
        updated_at: j.updatedAt || now,
        log: j.log || [],
      }));

      const { data, error } = await supabase.from("jobs").insert(rows).select();
      if (!error && data) {
        setJobs(data.map(jobFromDB));
        localStorage.removeItem("jobhub_jobs");
        localStorage.removeItem("jobhub_links");
        localStorage.removeItem("jobhub_profile");
      }
    } catch { /* ignore errors during migration */ }
    setShowMigrationBanner(false);
  }

  function handleMigrationDismiss() {
    // Just clear the banner; don't delete localStorage so they can try again later
    setShowMigrationBanner(false);
  }

  // ── Sign out ───────────────────────────────────────────────────────────────

  async function handleSignOut() {
    await supabase.auth.signOut();
    setPage("tracker");
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const pendingReminders = (jobs || []).filter((j) => {
    if (["Offer", "Rejected"].includes(j.status) || !j.dateApplied) return false;
    const days = Math.floor((Date.now() - new Date(j.dateApplied).getTime()) / 86400000);
    return days >= 7;
  }).length;

  // ── Render gates ──────────────────────────────────────────────────────────

  if (session === undefined) return <Spinner />;                  // auth not yet resolved
  if (!session) return <AuthScreen />;                            // not logged in
  if (jobs === null || links === null) return <Spinner />;        // data still loading

  // ── Main app ──────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">

      {/* ── Sidebar — hidden on mobile ────────────────────────────────────── */}
      <aside className="hidden md:flex w-52 bg-white border-r border-gray-200 flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-200">
          <span className="text-lg font-bold text-indigo-600">JobHub</span>
        </div>

        <nav className="flex-1 py-3">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left min-h-[44px] transition-colors ${
                page === item.id
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.id === "reminders" && pendingReminders > 0 && (
                <span className="ml-auto bg-amber-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {pendingReminders}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-4 py-2 text-xs text-gray-400">
          {jobs.length} job{jobs.length !== 1 ? "s" : ""} tracked
        </div>

        <button
          onClick={handleSignOut}
          className="mx-3 mb-3 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2 min-h-[40px]"
        >
          <SignOutIcon />
          Sign Out
        </button>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">

          {/* Global data error */}
          {dataError && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
              <span>{dataError}</span>
              <button onClick={() => setDataError("")} className="ml-4 text-red-400 hover:text-red-600 text-lg leading-none">×</button>
            </div>
          )}

          {page === "tracker" && (
            <Tracker
              jobs={jobs}
              setJobs={setJobs}
              links={links}
              setLinks={setLinks}
              userId={session.user.id}
              showMigrationBanner={showMigrationBanner}
              onImportMigration={handleMigrationImport}
              onDismissMigration={handleMigrationDismiss}
            />
          )}
          {page === "reminders" && <Reminders jobs={jobs} />}
          {page === "profile" && (
            <ProfileHub
              profile={profile}
              setProfile={setProfile}
              userId={session.user.id}
            />
          )}
        </main>

        {/* ── Bottom nav — mobile only ───────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-40 safe-area-inset-bottom">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] text-xs relative transition-colors ${
                page === item.id ? "text-indigo-600" : "text-gray-500"
              }`}
            >
              {item.icon}
              <span className="mt-0.5">{item.label}</span>
              {item.id === "reminders" && pendingReminders > 0 && (
                <span className="absolute top-1.5 right-[22%] bg-amber-400 text-white text-[10px] font-bold px-1 rounded-full min-w-[16px] text-center leading-4">
                  {pendingReminders}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={handleSignOut}
            className="flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] text-xs text-gray-500"
          >
            <SignOutIcon />
            <span className="mt-0.5">Sign Out</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
