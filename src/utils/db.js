// Mappers between Supabase DB rows (snake_case) and React state (camelCase).
// Both directions are needed: fromDB when reading, toDB when writing.

export function jobFromDB(row) {
  return {
    id: row.id,
    company: row.company || "",
    role: row.role || "",
    dateApplied: row.date_applied || "",
    status: row.status || "Applied",
    source: row.source || "",
    category: row.category || "SWE",
    notes: row.notes || "",
    jobUrl: row.job_url || "",
    updatedAt: row.updated_at || null,
    log: row.log || [],
  };
}

export function jobToDB(form, userId) {
  return {
    user_id: userId,
    company: form.company || "",
    role: form.role || "",
    date_applied: form.dateApplied || null,
    status: form.status || "Applied",
    source: form.source || "",
    category: form.category || "SWE",
    notes: form.notes || "",
    job_url: form.jobUrl || "",
    updated_at: new Date().toISOString(),
    log: form.log || [],
  };
}

export function linkFromDB(row) {
  return {
    id: row.id,
    label: row.label || "",
    url: row.url || "",
    subtitle: row.subtitle || "",
    color: row.color || "bg-blue-500",
    noUrl: row.no_url || false,
    sort_order: row.sort_order ?? 0,
  };
}

export function profileFromDB(row) {
  return {
    name: row.name || "",
    title: row.title || "",
    bio: row.bio || "",
    linkedin: row.linkedin || "",
    github: row.github || "",
    portfolio: row.portfolio || "",
    skills: row.skills || "",
  };
}
