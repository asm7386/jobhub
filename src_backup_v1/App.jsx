import { useState } from "react";
import { loadJobs, loadProfile } from "./utils/storage";
import Tracker from "./pages/Tracker";
import Reminders from "./pages/Reminders";
import ProfileHub from "./pages/ProfileHub";

const NAV = [
  {
    id: "tracker",
    label: "Tracker",
    icon: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Profile Hub",
    icon: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function App() {
  const [page, setPage] = useState("tracker");
  const [jobs, setJobs] = useState(() => loadJobs());
  const [profile, setProfile] = useState(() => loadProfile());

  const pendingReminders = jobs.filter((j) => {
    if (["Offer", "Rejected"].includes(j.status) || !j.dateApplied) return false;
    const days = Math.floor((Date.now() - new Date(j.dateApplied).getTime()) / 86400000);
    return days >= 7;
  }).length;

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-200">
          <span className="text-lg font-bold text-indigo-600">JobHub</span>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left ${
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

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        {page === "tracker" && <Tracker jobs={jobs} setJobs={setJobs} />}
        {page === "reminders" && <Reminders jobs={jobs} />}
        {page === "profile" && <ProfileHub profile={profile} setProfile={setProfile} />}
      </main>
    </div>
  );
}
