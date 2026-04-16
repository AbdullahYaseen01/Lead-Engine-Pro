import axios from "axios";
import randomUseragent from "random-useragent";
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
  concurrency: 6
});

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

    const { data } = await googleClient.get("/textsearch/json", { params });
    const places = data.results || [];

    const placeRecords = await Promise.all(
      places.map((place) =>
        detailsQueue.add(async () => {
          let website = "";
          if (place.place_id) {
            try {
              const detailRes = await googleClient.get("/details/json", {
                params: {
                  key: env.googlePlacesApiKey,
                  place_id: place.place_id,
                  fields: "name,website"
                }
              });
              website = detailRes.data?.result?.website || "";
            } catch {
              website = "";
            }
          }
          return {
            businessName: place.name || "",
            websiteLink: normalizeWebsite(website),
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
          "User-Agent": randomUseragent.getRandom() || "Mozilla/5.0"
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
