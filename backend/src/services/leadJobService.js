import PQueue from "p-queue";
import { env } from "../config/env.js";
import { dedupeByNameAndWebsite } from "../utils/helpers.js";
import { discoverEmailForBusiness, searchGooglePlaces } from "./providers.js";

const googleQueue = new PQueue({
  intervalCap: env.maxGoogleQps,
  interval: 1000,
  concurrency: 20
});

const crawlerQueue = new PQueue({ concurrency: 50 });
const comboQueue = new PQueue({ concurrency: 8 });

export async function generateLeadRows({ states, niches, targetLeads = 200 }) {
  const combinations = [];
  for (const state of states) {
    for (const niche of niches) {
      combinations.push({ state, niche });
    }
  }

  if (combinations.length === 0) {
    return [];
  }

  const collected = [];
  let stopRequested = false;

  await Promise.all(
    combinations.map((combo) =>
      comboQueue.add(async () => {
        if (stopRequested) return;

        const foundBusinesses = await googleQueue.add(() => searchGooglePlaces(combo));
        if (stopRequested) return;

        await Promise.all(
          foundBusinesses.map((business) =>
            crawlerQueue.add(async () => {
              if (stopRequested) return;
              const email = await discoverEmailForBusiness(business);
              if (stopRequested) return;
              collected.push({ ...business, email: email || "" });
              if (collected.length >= targetLeads) {
                stopRequested = true;
              }
            })
          )
        );

      })
    )
  );

  return dedupeByNameAndWebsite(collected).slice(0, targetLeads);
}
