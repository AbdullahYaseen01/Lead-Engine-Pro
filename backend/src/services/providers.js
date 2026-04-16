import axios from "axios";
import PQueue from "p-queue";
import { env } from "../config/env.js";
import { extractEmails, normalizeWebsite, sleep } from "../utils/helpers.js";

const googleClient = axios.create({
  baseURL: "https://maps.googleapis.com/maps/api/place",
  timeout: 15000
});

const detailsQueue = new PQueue({
  intervalCap: env.maxGoogleQps,
  interval: 1000,
  concurrency: 20
});

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
];

const pickUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

async function fetchTextSearchWithRetry(params) {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await googleClient.get("/textsearch/json", { params });
      return response.data;
    } catch {
      if (attempt === maxAttempts) return null;
      await sleep(700 * attempt);
    }
  }
  return null;
}

export async function searchGooglePlaces({ niche, state }) {
  if (!env.googlePlacesApiKey) return [];

  const results = [];
  let nextPageToken = null;
  let pageCount = 0;

  do {
    const params = {
      key: env.googlePlacesApiKey,
      query: `${niche} in ${state}, USA`
    };

    if (nextPageToken) {
      params.pagetoken = nextPageToken;
      await sleep(2200);
    }

    const data = await fetchTextSearchWithRetry(params);
    if (!data) {
      // Skip this combo page when Google keeps timing out; continue other combos.
      break;
    }
    const places = data.results || [];

    const placeRecords = await Promise.all(
      places.map((place) =>
        detailsQueue.add(async () => {
          let website = "";
          let phoneNumber = "";
          if (place.place_id) {
            try {
              const detailRes = await googleClient.get("/details/json", {
                params: {
                  key: env.googlePlacesApiKey,
                  place_id: place.place_id,
                  fields: "name,website,formatted_phone_number"
                }
              });
              const result = detailRes.data?.result;
              website = result?.website || "";
              phoneNumber = result?.formatted_phone_number || "";
            } catch {
              website = "";
            }
          }
          return {
            businessName: place.name || "",
            websiteLink: normalizeWebsite(website),
            phoneNumber,
            category: niche,
            state
          };
        })
      )
    );
    results.push(...placeRecords);

    nextPageToken = data.next_page_token || null;
    pageCount += 1;
  } while (nextPageToken && pageCount < 3);

  return results;
}

async function crawlWebsiteForEmail(website) {
  const targets = [website, `${website.replace(/\/$/, "")}/contact`];

  for (const target of targets) {
    try {
      const { data } = await axios.get(target, {
        timeout: 12000,
        headers: {
          "User-Agent": pickUserAgent()
        }
      });
      const emails = extractEmails(typeof data === "string" ? data : "");
      if (emails.length > 0) return emails[0];
    } catch {
      continue;
    }
  }
  return "";
}

async function hunterFallback(domain) {
  if (!env.hunterApiKey || !domain) return "";
  try {
    const { data } = await axios.get("https://api.hunter.io/v2/domain-search", {
      params: { domain, api_key: env.hunterApiKey },
      timeout: 12000
    });
    return data?.data?.emails?.[0]?.value || "";
  } catch {
    return "";
  }
}

async function serpFallback(query) {
  if (!env.serpApiKey) return "";
  try {
    const { data } = await axios.get("https://serpapi.com/search.json", {
      params: { q: query, api_key: env.serpApiKey },
      timeout: 12000
    });
    const snippets = (data?.organic_results || []).map((r) => `${r.snippet || ""} ${r.link || ""}`).join(" ");
    return extractEmails(snippets)[0] || "";
  } catch {
    return "";
  }
}

export async function discoverEmailForBusiness(business) {
  if (!business.websiteLink) return "";

  await sleep(env.websiteCrawlDelayMs);
  const direct = await crawlWebsiteForEmail(business.websiteLink);
  if (direct) return direct;

  let domain = "";
  try {
    domain = new URL(business.websiteLink).hostname.replace(/^www\./, "");
  } catch {
    domain = "";
  }

  const hunterEmail = await hunterFallback(domain);
  if (hunterEmail) return hunterEmail;

  return serpFallback(`${business.businessName} ${domain} email`);
}
