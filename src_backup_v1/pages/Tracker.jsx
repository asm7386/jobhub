import { useState, useRef } from "react";
import { saveJobs, loadLinks, saveLinks } from "../utils/storage";

const STATUSES = ["Applied", "Phone Screen", "Interview", "Offer", "Rejected", "Ghosted"];
const CATEGORIES = ["SWE", "Support", "Data", "ML", "Other"];

const STATUS_COLORS = {
  Applied: "bg-blue-100 text-blue-800",
  "Phone Screen": "bg-yellow-100 text-yellow-800",
  Interview: "bg-purple-100 text-purple-800",
  Offer: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Ghosted: "bg-gray-100 text-gray-600",
};

const EMPTY_FORM = { company: "", role: "", dateApplied: "", status: "Applied", source: "", category: "SWE", notes: "" };

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const applied = new Date(dateStr);
  applied.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today - applied) / 86400000);
}

// ─── Link edit modal ──────────────────────────────────────────────────────────

function LinkEditModal({ link, onSave, onClose }) {
  const isResume = !!link.noUrl;
  const [form, setForm] = useState({ label: link.label, url: link.url, subtitle: link.subtitle });

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...link, ...form });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-4">Edit Link</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {!isResume && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={form.label} onChange={(e) => set("label", e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://..." />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Quick links tiles ────────────────────────────────────────────────────────

function QuickLinks() {
  const [links, setLinks] = useState(() => loadLinks());
  const [editing, setEditing] = useState(null);

  function handleSave(updated) {
    const next = links.map((l) => l.id === updated.id ? updated : l);
    setLinks(next);
    saveLinks(next);
    setEditing(null);
  }

  function handleTileClick(link) {
    if (link.url) window.open(link.url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <div className="flex gap-3 mb-5 flex-wrap">
        {links.map((link) => (
          <div
            key={link.id}
            className="group relative bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 min-w-[160px] cursor-pointer hover:border-indigo-300 hover:shadow-sm"
            onClick={() => handleTileClick(link)}
          >
            <div className={`w-8 h-8 rounded-lg ${link.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
              {link.label.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{link.label}</div>
              <div className="text-xs text-gray-400 truncate max-w-[120px]">{link.subtitle}</div>
            </div>
            <button
              className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center justify-center w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-500"
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
      </div>
      {editing && (
        <LinkEditModal link={editing} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

// ─── Job modal ────────────────────────────────────────────────────────────────

function JobModal({ job, onSave, onClose }) {
  const [form, setForm] = useState(job || EMPTY_FORM);

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    onSave(form);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{job ? "Edit Job" : "Add Job"}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={form.company} onChange={(e) => set("company", e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={form.role} onChange={(e) => set("role", e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Applied</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={form.dateApplied} onChange={(e) => set("dateApplied", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={form.source} onChange={(e) => set("source", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Job row ──────────────────────────────────────────────────────────────────

function JobRow({ job, onEdit, onDelete, jobs, setJobs }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(job.notes || "");
  const [savedLabel, setSavedLabel] = useState(false);
  const debounceRef = useRef(null);
  const savedTimerRef = useRef(null);

  const days = daysAgo(job.dateApplied);
  const isClosed = job.status === "Rejected" || job.status === "Offer";
  let daysColor = "text-gray-700";
  if (isClosed) daysColor = "text-gray-400";
  else if (days !== null && days >= 14) daysColor = "text-amber-600 font-medium";

  function handleNotes(val) {
    setNotes(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const updated = jobs.map((j) => j.id === job.id ? { ...j, notes: val } : j);
      setJobs(updated);
      saveJobs(updated);
      setSavedLabel(true);
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedLabel(false), 1500);
    }, 500);
  }

  return (
    <>
      <tr className="hover:bg-gray-50 border-b border-gray-100">
        <td className="px-3 py-2.5 text-sm">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-gray-400 hover:text-gray-600 mr-2 text-xs w-4 inline-block text-center"
            style={{ display: "inline-block", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            ▶
          </button>
          {job.company}
        </td>
        <td className="px-3 py-2.5 text-sm text-gray-700">{job.role}</td>
        <td className="px-3 py-2.5 text-sm text-gray-500">{job.dateApplied}</td>
        <td className={`px-3 py-2.5 text-sm tabular-nums ${daysColor}`}>
          {days !== null ? days : "—"}
        </td>
        <td className="px-3 py-2.5">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[job.status] || "bg-gray-100 text-gray-600"}`}>{job.status}</span>
        </td>
        <td className="px-3 py-2.5 text-sm text-gray-500">{job.source}</td>
        <td className="px-3 py-2.5 text-sm text-gray-500">{job.category}</td>
        <td className="px-3 py-2.5 text-sm">
          <button onClick={() => onEdit(job)} className="text-indigo-600 hover:underline mr-3">Edit</button>
          <button onClick={() => onDelete(job.id)} className="text-red-500 hover:underline">Del</button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={8} className="px-6 py-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">Notes</label>
              {savedLabel && <span className="text-xs text-green-600 font-medium">Saved</span>}
            </div>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-white"
              rows={3}
              value={notes}
              onChange={(e) => handleNotes(e.target.value)}
              placeholder="Add notes..."
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Tracker page ─────────────────────────────────────────────────────────────

export default function Tracker({ jobs, setJobs }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [modal, setModal] = useState(null);

  const stats = {
    total: jobs.length,
    active: jobs.filter((j) => !["Offer", "Rejected", "Ghosted"].includes(j.status)).length,
    interviews: jobs.filter((j) => j.status === "Interview").length,
    offers: jobs.filter((j) => j.status === "Offer").length,
  };

  const filtered = jobs.filter((j) => {
    const matchSearch = !search || j.company.toLowerCase().includes(search.toLowerCase()) || j.role.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || j.status === statusFilter;
    const matchCategory = categoryFilter === "All" || j.category === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  function handleSave(form) {
    if (modal.mode === "add") {
      const newJob = { ...form, id: Date.now().toString() };
      const updated = [...jobs, newJob];
      setJobs(updated);
      saveJobs(updated);
    } else {
      const updated = jobs.map((j) => j.id === modal.job.id ? { ...modal.job, ...form } : j);
      setJobs(updated);
      saveJobs(updated);
    }
    setModal(null);
  }

  function handleDelete(id) {
    if (!confirm("Delete this job?")) return;
    const updated = jobs.filter((j) => j.id !== id);
    setJobs(updated);
    saveJobs(updated);
  }

  function exportCSV() {
    const headers = ["Company", "Role", "Date Applied", "Status", "Source", "Category", "Notes"];
    const rows = jobs.map((j) => [j.company, j.role, j.dateApplied, j.status, j.source, j.category, j.notes].map((v) => `"${(v || "").replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jobhub_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.trim().split("\n").slice(1);
      const imported = lines.map((line) => {
        const parts = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || [];
        const clean = parts.map((p) => p.replace(/^"|"$/g, "").replace(/""/g, '"'));
        return {
          id: Date.now().toString() + Math.random(),
          company: clean[0] || "",
          role: clean[1] || "",
          dateApplied: clean[2] || "",
          status: clean[3] || "Applied",
          source: clean[4] || "",
          category: clean[5] || "Other",
          notes: clean[6] || "",
        };
      });
      const updated = [...jobs, ...imported];
      setJobs(updated);
      saveJobs(updated);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const chipBase = "px-3 py-1 rounded-full text-xs font-medium border";
  const chipActive = "bg-indigo-600 text-white border-indigo-600";
  const chipInactive = "bg-white text-gray-600 border-gray-300 hover:border-indigo-300 hover:text-indigo-600";

  return (
    <div className="flex flex-col h-full">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "Total Applied", value: stats.total, color: "text-indigo-600" },
          { label: "Active", value: stats.active, color: "text-blue-600" },
          { label: "Interviews", value: stats.interviews, color: "text-purple-600" },
          { label: "Offers", value: stats.offers, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <QuickLinks />

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48"
          placeholder="Search company or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="ml-auto flex gap-2">
          <button onClick={() => setModal({ mode: "add" })} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ Add Job</button>
          <button onClick={exportCSV} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Export CSV</button>
          <label className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
            Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
          </label>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 mb-2 flex-wrap">
        {["All", ...STATUSES].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`${chipBase} ${statusFilter === s ? chipActive : chipInactive}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Category filter chips */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {["All", ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCategoryFilter(c)} className={`${chipBase} ${categoryFilter === c ? chipActive : chipInactive}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
              <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Applied</th>
              <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Days</th>
              <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
              <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No jobs found.</td></tr>
            ) : (
              filtered.map((job) => (
                <JobRow key={job.id} job={job} jobs={jobs} setJobs={setJobs} onEdit={(j) => setModal({ mode: "edit", job: j })} onDelete={handleDelete} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <JobModal
          job={modal.mode === "edit" ? modal.job : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
