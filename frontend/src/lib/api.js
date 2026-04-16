const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || `${window.location.origin}/api/leads`;

export async function generateLeads(payload) {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Failed to generate leads");
  return res.blob();
}
