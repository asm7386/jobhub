import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { jobFromDB, linkFromDB, profileFromDB } from "./utils/db";
import Tracker from "./pages/Tracker";
import Reminders from "./pages/Reminders";
import ProfileHub from "./pages/ProfileHub";

// ─── Fixed owner ID ───────────────────────────────────────────────────────────
// This is a hardcoded UUID used as user_id for all DB rows.
// Same ID is used on every device — no login needed.
// Change this value if you ever need to reset all data.
const OWNER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// ─── Default links ────────────────────────────────────────────────────────────

const DEFAULT_LINKS = [
  { label: "LinkedIn",  url: "https://linkedin.com/in/yourname", subtitle: "linkedin.com/in/yourname", color: "bg-blue-500",   no_url: false, sort_order: 0 },
  { label: "GitHub",    url: "https://github.com/yourname",      subtitle: "github.com/yourname",      color: "bg-gray-700",   no_url: false, sort_order: 1 },
  { label: "Portfolio", url: "https://yoursite.dev",             subtitle: "yoursite.dev",             color: "bg-purple-500", no_url: false, sort_order: 2 },
  { label: "Resume",    url: "",                                 subtitle: "v1 — Mar 2026",            color: "bg-orange-500", no_url: true,  sort_order: 3 },
  { label: "Email",     url: "mailto:your@email.com",            subtitle: "your@email.com",           color: "bg-green-500",  no_url: false, sort_order: 4 },
];

const EMPTY_PROFILE = { name: "", title: "", bio: "", linkedin: "", github: "", portfolio: "", skills: "" };

// ─── Nav ──────────────────────────────────────────────────────────────────────

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

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [page,    setPage]    = useState("tracker");
  const [jobs,    setJobs]    = useState(null);   // null = loading
  const [links,   setLinks]   = useState(null);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [dataError, setDataError] = useState("");
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);

  // Fetch everything on mount — no auth needed
  useEffect(() => { fetchAllData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAllData() {
    setDataError("");
    try {
      const [jobsRes, linksRes, profileRes] = await Promise.all([
        supabase.from("jobs").select("*").eq("user_id", OWNER_ID).order("created_at", { ascending: false }),
        supabase.from("links").select("*").eq("user_id", OWNER_ID).order("sort_order"),
        supabase.from("profiles").select("*").eq("user_id", OWNER_ID).maybeSingle(),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (linksRes.error) throw linksRes.error;

      const fetchedJobs = (jobsRes.data || []).map(jobFromDB);
      setJobs(fetchedJobs);

      // Check for local-storage migration
      if (fetchedJobs.length === 0) {
        try {
          const raw = localStorage.getItem("jobhub_jobs");
          if (raw) {
            const local = JSON.parse(raw);
            if (Array.isArray(local) && local.length > 0) setShowMigrationBanner(true);
          }
        } catch { /* ignore */ }
      }

      // Seed default links on first load
      if (!linksRes.data || linksRes.data.length === 0) {
        const rows = DEFAULT_LINKS.map((l) => ({ ...l, user_id: OWNER_ID }));
        const { data: seeded } = await supabase.from("links").insert(rows).select();
        setLinks((seeded || []).map(linkFromDB));
      } else {
        setLinks(linksRes.data.map(linkFromDB));
      }

      setProfile(profileRes.data ? profileFromDB(profileRes.data) : EMPTY_PROFILE);

    } catch (err) {
      setDataError("Failed to load data: " + (err.message || "Unknown error"));
      setJobs([]);
      setLinks([]);
    }
  }

  // ── Migration from localStorage ────────────────────────────────────────────

  async function handleMigrationImport() {
    try {
      const raw = localStorage.getItem("jobhub_jobs");
      if (!raw) { setShowMigrationBanner(false); return; }
      const localJobs = JSON.parse(raw);
      if (!Array.isArray(localJobs) || localJobs.length === 0) { setShowMigrationBanner(false); return; }

      const now = new Date().toISOString();
      const rows = localJobs.map((j) => ({
        user_id:     OWNER_ID,
        company:     j.company || "",
        role:        j.role || "",
        date_applied: j.dateApplied || null,
        status:      j.status || "Applied",
        source:      j.source || "",
        category:    j.category || "SWE",
        notes:       j.notes || "",
        job_url:     j.jobUrl || "",
        updated_at:  j.updatedAt || now,
        log:         j.log || [],
      }));

      const { data, error } = await supabase.from("jobs").insert(rows).select();
      if (!error && data) {
        setJobs(data.map(jobFromDB));
        localStorage.removeItem("jobhub_jobs");
        localStorage.removeItem("jobhub_links");
        localStorage.removeItem("jobhub_profile");
      }
    } catch { /* ignore */ }
    setShowMigrationBanner(false);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const pendingReminders = (jobs || []).filter((j) => {
    if (["Offer", "Rejected"].includes(j.status) || !j.dateApplied) return false;
    const days = Math.floor((Date.now() - new Date(j.dateApplied).getTime()) / 86400000);
    return days >= 7;
  }).length;

  // ── Loading gate ───────────────────────────────────────────────────────────

  if (jobs === null || links === null) return <Spinner />;

  // ── Main app ───────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">

      {/* Sidebar — desktop only */}
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
        <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-400">
          {jobs.length} job{jobs.length !== 1 ? "s" : ""} tracked
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">

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
              userId={OWNER_ID}
              showMigrationBanner={showMigrationBanner}
              onImportMigration={handleMigrationImport}
              onDismissMigration={() => setShowMigrationBanner(false)}
            />
          )}
          {page === "reminders" && <Reminders jobs={jobs} />}
          {page === "profile"   && <ProfileHub profile={profile} setProfile={setProfile} userId={OWNER_ID} />}
        </main>

        {/* Bottom nav — mobile only */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-40">
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
        </nav>
      </div>
    </div>
  );
}
