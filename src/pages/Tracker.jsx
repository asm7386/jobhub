import { useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { jobFromDB, linkFromDB } from "../utils/db";
import { loadPresets, savePresets } from "../utils/storage";

const STATUSES   = ["Applied", "Phone Screen", "Interview", "Offer", "Rejected", "Ghosted"];
const CATEGORIES = ["SWE", "Support", "Data", "ML", "Other"];

const STATUS_COLORS = {
  Applied:      "bg-blue-100 text-blue-800",
  "Phone Screen": "bg-yellow-100 text-yellow-800",
  Interview:    "bg-purple-100 text-purple-800",
  Offer:        "bg-green-100 text-green-800",
  Rejected:     "bg-red-100 text-red-800",
  Ghosted:      "bg-gray-100 text-gray-600",
};

const EMPTY_FORM = {
  company: "", role: "", dateApplied: "", status: "Applied",
  source: "", category: "SWE", notes: "", jobUrl: "",
};

const LINK_COLORS = [
  "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-purple-500",
  "bg-green-500", "bg-teal-500", "bg-orange-500", "bg-red-500",
  "bg-pink-500", "bg-gray-600",
];

const SOURCE_DOMAINS = [
  ["linkedin.com", "LinkedIn"], ["indeed.com", "Indeed"],
  ["greenhouse.io", "Greenhouse"], ["lever.co", "Lever"],
  ["workday.com", "Workday"], ["myworkdayjobs.com", "Workday"],
  ["smartrecruiters.com", "SmartRecruiters"], ["icims.com", "iCIMS"],
  ["taleo.net", "Taleo"], ["jobvite.com", "Jobvite"],
  ["glassdoor.com", "Glassdoor"], ["ziprecruiter.com", "ZipRecruiter"],
  ["wellfound.com", "Wellfound"], ["angel.co", "AngelList"],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const applied = new Date(dateStr);
  applied.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today - applied) / 86400000);
}

function relativeDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - target) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 30)  return `${diff}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function detectSource(url) {
  if (!url) return "";
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    for (const [domain, name] of SOURCE_DOMAINS) {
      if (hostname === domain || hostname.endsWith("." + domain)) return name;
    }
  } catch {}
  return "";
}

function parseCSVLine(line) {
  const parts = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || [];
  return parts.map((p) => p.replace(/^"|"$/g, "").replace(/""/g, '"'));
}

function jobsToCSV(list) {
  const headers = ["Company", "Role", "Date Applied", "Status", "Source", "Category", "Notes", "Job URL"];
  const rows = list.map((j) =>
    [j.company, j.role, j.dateApplied, j.status, j.source, j.category, j.notes, j.jobUrl || ""]
      .map((v) => `"${(v || "").replace(/"/g, '""')}"`)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Sort header ──────────────────────────────────────────────────────────────

function SortHeader({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  return (
    <th
      className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={active ? "text-indigo-500" : "text-gray-300"}>
          {active ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </th>
  );
}

// ─── Migration banner ─────────────────────────────────────────────────────────

function MigrationBanner({ onImport, onDismiss }) {
  return (
    <div className="mb-4 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 text-sm text-indigo-800">
        <span className="font-medium">Local data found.</span> You have job applications saved locally. Import them to your account so they sync across devices.
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onImport}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 min-h-[36px]"
        >
          Import
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 text-sm border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-100 min-h-[36px]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─── Link modals ──────────────────────────────────────────────────────────────

function LinkEditModal({ link, onSave, onDelete, onClose }) {
  const isResume = !!link.noUrl;
  const [form, setForm] = useState({ label: link.label, url: link.url, subtitle: link.subtitle });
  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-4">Edit Link</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...link, ...form }); }} className="space-y-3">
          {!isResume && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] md:min-h-0" value={form.label} onChange={(e) => set("label", e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] md:min-h-0" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://..." />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] md:min-h-0" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
          </div>
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={() => onDelete(link.id)} className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg min-h-[44px] md:min-h-0">Delete</button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 min-h-[44px] md:min-h-0">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 min-h-[44px] md:min-h-0">Save</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function LinkAddModal({ onSave, onClose }) {
  const [form, setForm] = useState({ label: "", url: "", subtitle: "", color: LINK_COLORS[0] });
  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-4">Add Link</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (!form.label.trim()) return; onSave(form); }} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] md:min-h-0" value={form.label} onChange={(e) => set("label", e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] md:min-h-0" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] md:min-h-0" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {LINK_COLORS.map((c) => (
                <button key={c} type="button"
                  className={`w-7 h-7 rounded-full ${c} ${form.color === c ? "ring-2 ring-offset-2 ring-indigo-500" : ""}`}
                  onClick={() => set("color", c)}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 min-h-[44px] md:min-h-0">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 min-h-[44px] md:min-h-0">Add</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Quick links tiles ────────────────────────────────────────────────────────

function QuickLinks({ links, setLinks, userId }) {
  const [editing, setEditing] = useState(null);
  const [adding,  setAdding]  = useState(false);
  const [linkError, setLinkError] = useState("");

  async function handleSave(updated) {
    setLinkError("");
    const { error } = await supabase
      .from("links")
      .update({ label: updated.label, url: updated.url, subtitle: updated.subtitle })
      .eq("id", updated.id);
    if (error) { setLinkError("Failed to save link."); return; }
    setLinks(links.map((l) => l.id === updated.id ? updated : l));
    setEditing(null);
  }

  async function handleAdd(newLink) {
    setLinkError("");
    const { data, error } = await supabase
      .from("links")
      .insert({
        user_id:    userId,
        label:      newLink.label,
        url:        newLink.url || "",
        subtitle:   newLink.subtitle || "",
        color:      newLink.color || "bg-blue-500",
        no_url:     false,
        sort_order: links.length,
      })
      .select()
      .single();
    if (error) { setLinkError("Failed to add link."); return; }
    setLinks([...links, linkFromDB(data)]);
    setAdding(false);
  }

  async function handleDelete(id) {
    const { error } = await supabase.from("links").delete().eq("id", id);
    if (!error) setLinks(links.filter((l) => l.id !== id));
    setEditing(null);
  }

  return (
    <>
      {linkError && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{linkError}</div>
      )}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        {links.map((link) => (
          <div
            key={link.id}
            className="group relative bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 min-w-[150px] cursor-pointer hover:border-indigo-300 hover:shadow-sm min-h-[56px] md:min-h-0"
            onClick={() => link.url && window.open(link.url, "_blank", "noopener,noreferrer")}
          >
            <div className={`w-8 h-8 rounded-lg ${link.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
              {link.label.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{link.label}</div>
              <div className="text-xs text-gray-400 truncate max-w-[110px]">{link.subtitle}</div>
            </div>
            <button
              className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center justify-center w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-500"
              onClick={(e) => { e.stopPropagation(); setEditing(link); }}
              title="Edit"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={() => setAdding(true)}
          className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 shrink-0"
          title="Add link"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
      {editing && <LinkEditModal link={editing} onSave={handleSave} onDelete={handleDelete} onClose={() => setEditing(null)} />}
      {adding  && <LinkAddModal onSave={handleAdd} onClose={() => setAdding(false)} />}
    </>
  );
}

// ─── Import preview modal ─────────────────────────────────────────────────────

function ImportPreviewModal({ incoming, existing, onConfirm, onClose }) {
  const existingKeys = new Set(existing.map((j) => `${j.company.toLowerCase()}|${j.role.toLowerCase()}`));
  const dupes    = incoming.filter((j) =>  existingKeys.has(`${j.company.toLowerCase()}|${j.role.toLowerCase()}`));
  const newItems = incoming.filter((j) => !existingKeys.has(`${j.company.toLowerCase()}|${j.role.toLowerCase()}`));
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-1">Import Preview</h2>
        <p className="text-sm text-gray-500 mb-4">
          {incoming.length} row{incoming.length !== 1 ? "s" : ""} — {newItems.length} new, {dupes.length} duplicate{dupes.length !== 1 ? "s" : ""}.
        </p>
        {dupes.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Duplicates (already in your account):</p>
            <ul className="space-y-1 max-h-36 overflow-y-auto">
              {dupes.map((j, i) => (
                <li key={i} className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                  {j.company} — {j.role}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {dupes.length > 0 && newItems.length > 0 && (
            <button onClick={() => onConfirm("skip")} className="w-full px-4 py-2.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 min-h-[44px]">
              Import {newItems.length} new (skip duplicates)
            </button>
          )}
          <button onClick={() => onConfirm("all")} className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 min-h-[44px]">
            Import all {incoming.length}
          </button>
          <button onClick={onClose} className="w-full px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Cleanup modal ────────────────────────────────────────────────────────────

function CleanupModal({ jobs, onCleanup, onClose }) {
  const rejected = jobs.filter((j) => j.status === "Rejected").length;
  const ghosted  = jobs.filter((j) => j.status === "Ghosted").length;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-1">Clean Up Jobs</h2>
        <p className="text-sm text-gray-500 mb-4">Permanently remove entries by status.</p>
        <div className="space-y-2 mb-4">
          <button disabled={rejected === 0} onClick={() => onCleanup("Rejected")}
            className="w-full flex justify-between items-center px-4 py-2.5 text-sm rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]">
            <span>Remove all Rejected</span>
            <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{rejected}</span>
          </button>
          <button disabled={ghosted === 0} onClick={() => onCleanup("Ghosted")}
            className="w-full flex justify-between items-center px-4 py-2.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]">
            <span>Remove all Ghosted</span>
            <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{ghosted}</span>
          </button>
          <button disabled={rejected + ghosted === 0} onClick={() => onCleanup("both")}
            className="w-full flex justify-between items-center px-4 py-2.5 text-sm rounded-lg border border-gray-200 hover:bg-orange-50 hover:border-orange-200 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]">
            <span>Remove Rejected + Ghosted</span>
            <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{rejected + ghosted}</span>
          </button>
        </div>
        <button onClick={onClose} className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 min-h-[44px]">Cancel</button>
      </div>
    </div>
  );
}

// ─── Job modal ────────────────────────────────────────────────────────────────

function JobModal({ job, onSave, onClose }) {
  const [form, setForm] = useState(job ? { ...EMPTY_FORM, ...job } : EMPTY_FORM);
  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  function handleUrlChange(url) {
    setForm((p) => {
      const detected = detectSource(url);
      return { ...p, jobUrl: url, source: !p.source && detected ? detected : p.source };
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-0 md:p-4" onClick={onClose}>
      <div
        className="bg-white w-full h-full md:h-auto md:rounded-xl md:shadow-xl md:max-w-lg md:mx-4 p-5 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">{job ? "Edit Job" : "Add Job"}</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (!form.company.trim() || !form.role.trim()) return; onSave(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] md:min-h-0" value={form.company} onChange={(e) => set("company", e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] md:min-h-0" value={form.role} onChange={(e) => set("role", e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Applied</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] md:min-h-0" value={form.dateApplied} onChange={(e) => set("dateApplied", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] md:min-h-0" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] md:min-h-0" value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="LinkedIn, Indeed…" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] md:min-h-0" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Posting URL
              <span className="ml-1 text-xs text-gray-400 font-normal">— auto-fills Source</span>
            </label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] md:min-h-0" value={form.jobUrl || ""} onChange={(e) => handleUrlChange(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 min-h-[44px] md:min-h-0">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 min-h-[44px] md:min-h-0">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Job row ──────────────────────────────────────────────────────────────────

function JobRow({ job, onEdit, onDelete, setJobs, isSelected, onToggleSelect }) {
  const [expanded,   setExpanded]   = useState(false);
  const [notes,      setNotes]      = useState(job.notes || "");
  const [savedLabel, setSavedLabel] = useState(false);
  const [noteError,  setNoteError]  = useState("");
  const [logText,    setLogText]    = useState("");
  const debounceRef    = useRef(null);
  const savedTimerRef  = useRef(null);

  const days     = daysAgo(job.dateApplied);
  const isClosed = job.status === "Rejected" || job.status === "Offer";
  let daysColor  = "text-gray-700";
  if (isClosed)                      daysColor = "text-gray-400";
  else if (days !== null && days >= 14) daysColor = "text-amber-600 font-medium";

  function handleNotes(val) {
    setNotes(val);
    setNoteError("");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const now = new Date().toISOString();
      // Optimistic local update
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, notes: val, updatedAt: now } : j));
      // Persist to Supabase
      const { error } = await supabase
        .from("jobs")
        .update({ notes: val, updated_at: now })
        .eq("id", job.id);
      if (error) {
        setNoteError("Notes failed to save.");
      } else {
        setSavedLabel(true);
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSavedLabel(false), 1500);
      }
    }, 500);
  }

  async function addLogEntry() {
    const text = logText.trim();
    if (!text) return;
    const now   = new Date().toISOString();
    const entry = { ts: now, text };
    const newLog = [...(job.log || []), entry];
    // Optimistic
    setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, log: newLog, updatedAt: now } : j));
    setLogText("");
    await supabase.from("jobs").update({ log: newLog, updated_at: now }).eq("id", job.id);
  }

  const logEntries = [...(job.log || [])].reverse();

  return (
    <>
      <tr className={`border-b border-gray-100 ${isSelected ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
        <td className="pl-3 pr-1 py-2.5 w-8">
          <input type="checkbox" checked={isSelected} onChange={onToggleSelect}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400 cursor-pointer" />
        </td>
        <td className="px-3 py-2.5 text-sm">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-gray-400 hover:text-gray-600 mr-2 text-xs w-4 inline-block text-center"
            style={{ display: "inline-block", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          >▶</button>
          {job.company}
        </td>
        <td className="px-3 py-2.5 text-sm text-gray-700">{job.role}</td>
        <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">{job.dateApplied}</td>
        <td className={`px-3 py-2.5 text-sm tabular-nums ${daysColor}`}>{days !== null ? days : "—"}</td>
        <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">{relativeDate(job.updatedAt)}</td>
        <td className="px-3 py-2.5">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[job.status] || "bg-gray-100 text-gray-600"}`}>{job.status}</span>
        </td>
        <td className="px-3 py-2.5 text-sm text-gray-500">{job.source}</td>
        <td className="px-3 py-2.5 text-sm text-gray-500">{job.category}</td>
        <td className="px-3 py-2.5 text-sm whitespace-nowrap">
          <button onClick={() => onEdit(job)} className="text-indigo-600 hover:underline mr-3">Edit</button>
          <button onClick={() => onDelete(job.id)} className="text-red-500 hover:underline">Del</button>
        </td>
      </tr>

      {expanded && (
        <tr className={`border-b border-gray-100 ${isSelected ? "bg-indigo-50/60" : "bg-gray-50"}`}>
          <td colSpan={10} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-500">Notes</label>
                  {savedLabel && <span className="text-xs text-green-600 font-medium">Saved</span>}
                </div>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-white"
                  rows={4} value={notes} onChange={(e) => handleNotes(e.target.value)} placeholder="Add notes…"
                />
                {noteError && <p className="text-xs text-red-600 mt-1">{noteError}</p>}
              </div>

              {/* Activity log */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Activity Log</label>
                <div className="space-y-1 mb-2 max-h-28 overflow-y-auto">
                  {logEntries.length === 0
                    ? <p className="text-xs text-gray-400">No log entries yet.</p>
                    : logEntries.map((entry, i) => (
                        <div key={i} className="flex gap-3 text-xs">
                          <span className="text-gray-400 shrink-0 whitespace-nowrap">{relativeDate(entry.ts)}</span>
                          <span className="text-gray-600">{entry.text}</span>
                        </div>
                      ))
                  }
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
                    placeholder="Add log entry…"
                    value={logText}
                    onChange={(e) => setLogText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addLogEntry()}
                  />
                  <button onClick={addLogEntry} className="px-2 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-200">+ Add</button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Tracker page ─────────────────────────────────────────────────────────────

export default function Tracker({
  jobs, setJobs,
  links, setLinks,
  userId,
  showMigrationBanner, onImportMigration, onDismissMigration,
}) {
  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sort,           setSort]           = useState({ key: null, dir: "asc" });
  const [modal,          setModal]          = useState(null);
  const [selected,       setSelected]       = useState(new Set());
  const [bulkStatus,     setBulkStatus]     = useState("");
  const [showCleanup,    setShowCleanup]    = useState(false);
  const [importPreview,  setImportPreview]  = useState(null);
  const [presets,        setPresets]        = useState(() => loadPresets());
  const [savingPreset,   setSavingPreset]   = useState(false);
  const [presetName,     setPresetName]     = useState("");
  const [error,          setError]          = useState("");
  const [busy,           setBusy]           = useState(false);

  // ── Derived: filter + sort ─────────────────────────────────────────────────

  const stats = {
    total:      jobs.length,
    active:     jobs.filter((j) => !["Offer", "Rejected", "Ghosted"].includes(j.status)).length,
    interviews: jobs.filter((j) => j.status === "Interview").length,
    offers:     jobs.filter((j) => j.status === "Offer").length,
  };

  const filtered = jobs.filter((j) => {
    const matchSearch   = !search || j.company.toLowerCase().includes(search.toLowerCase()) || j.role.toLowerCase().includes(search.toLowerCase());
    const matchStatus   = statusFilter   === "All" || j.status   === statusFilter;
    const matchCategory = categoryFilter === "All" || j.category === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  const displayed = sort.key
    ? [...filtered].sort((a, b) => {
        let av, bv;
        if (sort.key === "days") {
          av = daysAgo(a.dateApplied) ?? Infinity;
          bv = daysAgo(b.dateApplied) ?? Infinity;
        } else if (sort.key === "status") {
          av = STATUSES.indexOf(a.status);
          bv = STATUSES.indexOf(b.status);
        } else {
          av = (a[sort.key] || "").toString().toLowerCase();
          bv = (b[sort.key] || "").toString().toLowerCase();
        }
        if (av < bv) return sort.dir === "asc" ? -1 : 1;
        if (av > bv) return sort.dir === "asc" ?  1 : -1;
        return 0;
      })
    : filtered;

  function handleSort(key) {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  // ── Job CRUD ───────────────────────────────────────────────────────────────

  async function handleSave(form) {
    if (busy) return;
    setBusy(true); setError("");
    const now = new Date().toISOString();

    if (modal.mode === "add") {
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          user_id:     userId,
          company:     form.company,
          role:        form.role,
          date_applied: form.dateApplied || null,
          status:      form.status,
          source:      form.source || "",
          category:    form.category || "SWE",
          notes:       form.notes || "",
          job_url:     form.jobUrl || "",
          updated_at:  now,
          log:         [{ ts: now, text: "Application created" }],
        })
        .select()
        .single();
      if (error) { setError("Failed to add job."); setBusy(false); return; }
      setJobs((prev) => [jobFromDB(data), ...prev]);

    } else {
      const existing = modal.job;
      const log = [...(existing.log || [])];
      if (form.status !== existing.status) log.push({ ts: now, text: `Status → ${form.status}` });
      const { error } = await supabase
        .from("jobs")
        .update({
          company:     form.company,
          role:        form.role,
          date_applied: form.dateApplied || null,
          status:      form.status,
          source:      form.source || "",
          category:    form.category || "SWE",
          notes:       form.notes || "",
          job_url:     form.jobUrl || "",
          updated_at:  now,
          log,
        })
        .eq("id", existing.id);
      if (error) { setError("Failed to update job."); setBusy(false); return; }
      setJobs((prev) => prev.map((j) => j.id === existing.id ? { ...existing, ...form, updatedAt: now, log } : j));
    }

    setModal(null);
    setBusy(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this job?")) return;
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) { setError("Failed to delete job."); return; }
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────

  function toggleSelect(id) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleSelectAll() {
    setSelected(
      displayed.every((j) => selected.has(j.id))
        ? new Set()
        : new Set(displayed.map((j) => j.id))
    );
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} job(s)?`)) return;
    const ids = [...selected];
    const { error } = await supabase.from("jobs").delete().in("id", ids);
    if (error) { setError("Failed to delete selected jobs."); return; }
    setJobs((prev) => prev.filter((j) => !selected.has(j.id)));
    setSelected(new Set());
  }

  async function handleBulkStatusChange() {
    if (!bulkStatus) return;
    const ids = [...selected];
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("jobs")
      .update({ status: bulkStatus, updated_at: now })
      .in("id", ids);
    if (error) { setError("Failed to update status."); return; }
    setJobs((prev) => prev.map((j) => {
      if (!selected.has(j.id)) return j;
      const log = [...(j.log || []), { ts: now, text: `Status → ${bulkStatus}` }];
      return { ...j, status: bulkStatus, updatedAt: now, log };
    }));
    setBulkStatus(""); setSelected(new Set());
  }

  function handleBulkExport() {
    downloadCSV(jobsToCSV(jobs.filter((j) => selected.has(j.id))), "jobhub_selected.csv");
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  async function handleCleanup(mode) {
    let query = supabase.from("jobs").delete();
    if      (mode === "Rejected") query = query.eq("status", "Rejected");
    else if (mode === "Ghosted")  query = query.eq("status", "Ghosted");
    else                          query = query.in("status", ["Rejected", "Ghosted"]);

    const { error } = await query;
    if (error) { setError("Clean up failed."); setShowCleanup(false); return; }

    setJobs((prev) => {
      if (mode === "Rejected") return prev.filter((j) => j.status !== "Rejected");
      if (mode === "Ghosted")  return prev.filter((j) => j.status !== "Ghosted");
      return prev.filter((j) => j.status !== "Rejected" && j.status !== "Ghosted");
    });
    setSelected(new Set());
    setShowCleanup(false);
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  function exportCSV() {
    downloadCSV(jobsToCSV(jobs), "jobhub_export.csv");
  }

  // ── Import (parse → preview modal → confirm) ───────────────────────────────

  function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.trim().split("\n").slice(1).filter(Boolean);
      const incoming = lines.map((line) => {
        const clean = parseCSVLine(line);
        return {
          company: clean[0] || "", role: clean[1] || "",
          dateApplied: clean[2] || "", status: clean[3] || "Applied",
          source: clean[4] || "", category: clean[5] || "Other",
          notes: clean[6] || "", jobUrl: clean[7] || "",
          log: [], updatedAt: null,
        };
      });
      setImportPreview(incoming);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleImportConfirm(mode) {
    const existingKeys = new Set(jobs.map((j) => `${j.company.toLowerCase()}|${j.role.toLowerCase()}`));
    const toAdd = mode === "skip"
      ? importPreview.filter((j) => !existingKeys.has(`${j.company.toLowerCase()}|${j.role.toLowerCase()}`))
      : importPreview;

    if (toAdd.length === 0) { setImportPreview(null); return; }

    const now = new Date().toISOString();
    const rows = toAdd.map((j) => ({
      user_id:     userId,
      company:     j.company,
      role:        j.role,
      date_applied: j.dateApplied || null,
      status:      j.status || "Applied",
      source:      j.source || "",
      category:    j.category || "Other",
      notes:       j.notes || "",
      job_url:     j.jobUrl || "",
      updated_at:  now,
      log:         [],
    }));

    const { data, error } = await supabase.from("jobs").insert(rows).select();
    if (error) { setError("Import failed."); setImportPreview(null); return; }
    if (data) setJobs((prev) => [...data.map(jobFromDB), ...prev]);
    setImportPreview(null);
  }

  // ── Filter presets (stored in localStorage — UI preference, not user data) ─

  function handleSavePreset() {
    const name = presetName.trim();
    if (!name) return;
    const preset = { id: Date.now().toString(), name, status: statusFilter, category: categoryFilter, search };
    const next = [...presets, preset];
    setPresets(next); savePresets(next);
    setSavingPreset(false); setPresetName("");
  }

  function handleDeletePreset(id) {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next); savePresets(next);
  }

  function applyPreset(preset) {
    setStatusFilter(preset.status);
    setCategoryFilter(preset.category);
    setSearch(preset.search);
  }

  // ── Shared chip class helpers ──────────────────────────────────────────────

  const chipBase     = "px-3 py-1 rounded-full text-xs font-medium border min-h-[36px] md:min-h-0 flex items-center";
  const chipActive   = "bg-indigo-600 text-white border-indigo-600";
  const chipInactive = "bg-white text-gray-600 border-gray-300 hover:border-indigo-300 hover:text-indigo-600";
  const allSelected  = displayed.length > 0 && displayed.every((j) => selected.has(j.id));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* Migration banner */}
      {showMigrationBanner && (
        <MigrationBanner onImport={onImportMigration} onDismiss={onDismissMigration} />
      )}

      {/* Job-level error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-4 text-red-400 hover:text-red-600 text-lg leading-none">×</button>
        </div>
      )}

      {/* Stats bar — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: "Total Applied", value: stats.total,      color: "text-indigo-600" },
          { label: "Active",        value: stats.active,     color: "text-blue-600"   },
          { label: "Interviews",    value: stats.interviews, color: "text-purple-600" },
          { label: "Offers",        value: stats.offers,     color: "text-green-600"  },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <QuickLinks links={links} setLinks={setLinks} userId={userId} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48 min-h-[44px] md:min-h-0"
          placeholder="Search company or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="ml-auto flex gap-2 flex-wrap">
          <button onClick={() => setModal({ mode: "add" })} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 min-h-[44px] md:min-h-0">+ Add Job</button>
          <button onClick={exportCSV} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px] md:min-h-0">Export CSV</button>
          <label className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer min-h-[44px] md:min-h-0 flex items-center">
            Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
          </label>
          <button onClick={() => setShowCleanup(true)} className="px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 min-h-[44px] md:min-h-0">Clean Up</button>
        </div>
      </div>

      {/* Status chips */}
      <div className="flex gap-1.5 mb-2 flex-wrap">
        {["All", ...STATUSES].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`${chipBase} ${statusFilter === s ? chipActive : chipInactive}`}>{s}</button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 mb-2 flex-wrap">
        {["All", ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCategoryFilter(c)} className={`${chipBase} ${categoryFilter === c ? chipActive : chipInactive}`}>{c}</button>
        ))}
      </div>

      {/* Saved filter presets */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap min-h-[28px]">
        {presets.length > 0 && (
          <>
            <span className="text-xs text-gray-400">Saved:</span>
            {presets.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-0.5 pl-2 pr-1 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                <button onClick={() => applyPreset(p)}>{p.name}</button>
                <button onClick={() => handleDeletePreset(p.id)} className="ml-1 w-4 h-4 flex items-center justify-center text-indigo-400 hover:text-indigo-700 rounded-full hover:bg-indigo-100">×</button>
              </span>
            ))}
          </>
        )}
        {savingPreset ? (
          <span className="inline-flex items-center gap-1.5">
            <input
              autoFocus
              className="border border-indigo-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 w-32"
              placeholder="View name…"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSavePreset(); if (e.key === "Escape") { setSavingPreset(false); setPresetName(""); } }}
            />
            <button onClick={handleSavePreset} className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700">Save</button>
            <button onClick={() => { setSavingPreset(false); setPresetName(""); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </span>
        ) : (
          <button onClick={() => setSavingPreset(true)} className="text-xs text-gray-400 hover:text-indigo-600 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Save view
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl flex-wrap">
          <span className="text-sm font-medium text-indigo-700">{selected.size} selected</span>
          <div className="h-4 w-px bg-indigo-200" />
          <button onClick={handleBulkDelete} className="text-sm text-red-600 hover:underline min-h-[36px] md:min-h-0">Delete</button>
          <div className="flex items-center gap-1.5">
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 min-h-[36px] md:min-h-0">
              <option value="">Change status…</option>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            {bulkStatus && (
              <button onClick={handleBulkStatusChange} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 min-h-[36px] md:min-h-0">Apply</button>
            )}
          </div>
          <button onClick={handleBulkExport} className="text-sm text-gray-600 hover:underline min-h-[36px] md:min-h-0">Export selected</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Clear selection</button>
        </div>
      )}

      {/* Table — horizontally scrollable on small screens */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto flex-1">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="pl-3 pr-1 py-3 w-8">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400 cursor-pointer" />
              </th>
              <SortHeader label="Company"      sortKey="company"     sort={sort} onSort={handleSort} />
              <SortHeader label="Role"         sortKey="role"        sort={sort} onSort={handleSort} />
              <SortHeader label="Date Applied" sortKey="dateApplied" sort={sort} onSort={handleSort} />
              <SortHeader label="Days"         sortKey="days"        sort={sort} onSort={handleSort} />
              <SortHeader label="Updated"      sortKey="updatedAt"   sort={sort} onSort={handleSort} />
              <SortHeader label="Status"       sortKey="status"      sort={sort} onSort={handleSort} />
              <SortHeader label="Source"       sortKey="source"      sort={sort} onSort={handleSort} />
              <SortHeader label="Category"     sortKey="category"    sort={sort} onSort={handleSort} />
              <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">No jobs found.</td></tr>
            ) : (
              displayed.map((job) => (
                <JobRow
                  key={job.id} job={job} setJobs={setJobs}
                  onEdit={(j) => setModal({ mode: "edit", job: j })}
                  onDelete={handleDelete}
                  isSelected={selected.has(job.id)}
                  onToggleSelect={() => toggleSelect(job.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modal && (
        <JobModal job={modal.mode === "edit" ? modal.job : null} onSave={handleSave} onClose={() => setModal(null)} />
      )}
      {showCleanup && (
        <CleanupModal jobs={jobs} onCleanup={handleCleanup} onClose={() => setShowCleanup(false)} />
      )}
      {importPreview && (
        <ImportPreviewModal incoming={importPreview} existing={jobs} onConfirm={handleImportConfirm} onClose={() => setImportPreview(null)} />
      )}
    </div>
  );
}
