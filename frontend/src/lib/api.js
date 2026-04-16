const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || `${window.location.origin}/api/leads`;

export async function generateLeads(payload) {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Failed to start lead generation");
  return res.json();
}

export async function getJobStatus(jobId) {
  const res = await fetch(`${API_BASE}/status/${jobId}`);
  if (!res.ok) {
    const error = new Error("Failed to fetch status");
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export function getExportUrl(jobId) {
  return `${API_BASE}/export/${jobId}`;
}
