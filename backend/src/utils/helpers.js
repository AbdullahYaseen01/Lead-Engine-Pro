export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const normalizeWebsite = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
};

export const extractEmails = (html = "") => {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/g;
  return [...new Set(html.match(regex) || [])];
};

export const dedupeByNameAndWebsite = (records) => {
  const map = new Map();
  for (const record of records) {
    const key = `${(record.businessName || "").trim().toLowerCase()}|${(record.websiteLink || "").trim().toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, record);
    }
  }
  return [...map.values()];
};

/** US leads: ensure CSV shows country code +1 before the formatted national number. */
export function formatPhoneWithUsCountryCode(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  const s = raw.replace(/\s+/g, " ");
  if (/^\+1(\s|\(|-|$)/i.test(s)) {
    const rest = s.replace(/^\+1\s*/i, "").trim();
    return rest ? `+1 ${rest}` : "+1";
  }
  if (/^1(\s|\(|-)/.test(s)) {
    const rest = s.replace(/^1\s*/, "").trim();
    return rest ? `+1 ${rest}` : "+1";
  }
  return `+1 ${s}`;
}
