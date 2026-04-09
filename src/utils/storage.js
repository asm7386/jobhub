export const JOBS_KEY = "jobhub_jobs";
export const PROFILE_KEY = "jobhub_profile";

const SEED_JOBS = [
  {
    id: "1",
    company: "Acme Corp",
    role: "Software Engineer",
    dateApplied: "2026-02-28",
    status: "Interview",
    source: "LinkedIn",
    category: "SWE",
    notes: "Had a great phone screen. On-site scheduled.",
  },
  {
    id: "2",
    company: "DataFlow Inc",
    role: "Data Analyst",
    dateApplied: "2026-03-01",
    status: "Applied",
    source: "Indeed",
    category: "Data",
    notes: "",
  },
  {
    id: "3",
    company: "NeuralWave",
    role: "ML Engineer",
    dateApplied: "2026-03-05",
    status: "Phone Screen",
    source: "Referral",
    category: "ML",
    notes: "Referred by Alex. Know the tech stack well.",
  },
  {
    id: "4",
    company: "HelpDesk Pro",
    role: "Support Engineer",
    dateApplied: "2026-02-20",
    status: "Rejected",
    source: "Company Site",
    category: "Support",
    notes: "Rejected after first round.",
  },
];

export function loadJobs() {
  try {
    const raw = localStorage.getItem(JOBS_KEY);
    if (raw === null) {
      localStorage.setItem(JOBS_KEY, JSON.stringify(SEED_JOBS));
      return SEED_JOBS;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_JOBS;
  }
}

export function saveJobs(jobs) {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : { name: "", title: "", bio: "", linkedin: "", github: "", portfolio: "", skills: "" };
  } catch {
    return { name: "", title: "", bio: "", linkedin: "", github: "", portfolio: "", skills: "" };
  }
}

export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export const LINKS_KEY = "jobhub_links";

const SEED_LINKS = [
  { id: "l1", label: "LinkedIn",  url: "https://linkedin.com/in/yourname", subtitle: "linkedin.com/in/yourname", color: "bg-blue-500" },
  { id: "l2", label: "GitHub",    url: "https://github.com/yourname",      subtitle: "github.com/yourname",      color: "bg-gray-700" },
  { id: "l3", label: "Portfolio", url: "https://yoursite.dev",             subtitle: "yoursite.dev",             color: "bg-purple-500" },
  { id: "l4", label: "Resume",    url: "",                                 subtitle: "v1 — Mar 2026",            color: "bg-orange-500", noUrl: true },
  { id: "l5", label: "Email",     url: "mailto:your@email.com",            subtitle: "your@email.com",           color: "bg-green-500" },
];

export function loadLinks() {
  try {
    const raw = localStorage.getItem(LINKS_KEY);
    if (raw === null) {
      localStorage.setItem(LINKS_KEY, JSON.stringify(SEED_LINKS));
      return SEED_LINKS;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_LINKS;
  }
}

export function saveLinks(links) {
  localStorage.setItem(LINKS_KEY, JSON.stringify(links));
}

export const PRESETS_KEY = "jobhub_filter_presets";

export function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePresets(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}
