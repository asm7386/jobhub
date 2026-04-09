export default function Reminders({ jobs }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const active = jobs
    .filter((j) => !["Offer", "Rejected"].includes(j.status) && j.dateApplied)
    .map((j) => {
      const applied = new Date(j.dateApplied);
      applied.setHours(0, 0, 0, 0);
      const days = Math.floor((today - applied) / (1000 * 60 * 60 * 24));
      return { ...j, days };
    })
    .sort((a, b) => b.days - a.days);

  function rowColor(days) {
    if (days >= 14) return "border-l-4 border-red-400 bg-red-50";
    if (days >= 7) return "border-l-4 border-amber-400 bg-amber-50";
    return "border-l-4 border-green-400 bg-green-50";
  }

  function badgeColor(days) {
    if (days >= 14) return "bg-red-100 text-red-700";
    if (days >= 7) return "bg-amber-100 text-amber-700";
    return "bg-green-100 text-green-700";
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-800">Reminders</h1>
        <p className="text-sm text-gray-500 mt-1">Jobs that may need a follow-up — not yet closed (no Offer or Rejection).</p>
      </div>

      <div className="flex gap-4 mb-5 text-sm">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-400 inline-block"></span> Under 7 days</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span> 7–13 days</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400 inline-block"></span> 14+ days</span>
      </div>

      {active.length === 0 ? (
        <div className="text-center text-gray-400 py-12 text-sm">No active jobs to follow up on.</div>
      ) : (
        <div className="space-y-3">
          {active.map((job) => (
            <div key={job.id} className={`rounded-xl px-4 py-3 ${rowColor(job.days)}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-800 text-sm">{job.company}</div>
                  <div className="text-gray-600 text-sm">{job.role}</div>
                  {job.notes && (
                    <div className="text-gray-500 text-xs mt-1 truncate max-w-md">{job.notes}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor(job.days)}`}>
                    {job.days === 0 ? "Today" : `${job.days}d ago`}
                  </span>
                  <span className="text-xs text-gray-500">{job.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
