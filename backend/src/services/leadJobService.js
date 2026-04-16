import crypto from "node:crypto";
import PQueue from "p-queue";
import { env } from "../config/env.js";
import { dedupeByNameAndWebsite } from "../utils/helpers.js";
import { discoverEmailForBusiness, searchGooglePlaces } from "./providers.js";

const googleQueue = new PQueue({
  intervalCap: env.maxGoogleQps,
  interval: 1000,
  concurrency: 3
});

const crawlerQueue = new PQueue({ concurrency: 6 });
const comboQueue = new PQueue({ concurrency: 3 });

const nowIso = () => new Date().toISOString();
const jobs = new Map();
const jobLeads = new Map();

function upsertJobProgress(
  jobId,
  status,
  progress,
  completed,
  total,
  statusText,
  leadCount = 0,
  meta = {}
) {
  const current = jobs.get(jobId);
  if (!current) return;
  jobs.set(jobId, {
    ...current,
    status,
    progress,
    completedCombinations: completed,
    totalCombinations: total,
    statusText,
    leadCount,
    updatedAt: nowIso(),
    ...meta
  });
}

export function getJobStatus(jobId) {
  return jobs.get(jobId) || null;
}

export function consumeJobLeads(jobId) {
  const leads = jobLeads.get(jobId) || [];
  jobLeads.delete(jobId);
  return leads;
}

export function createLeadJob({ states, niches, targetLeads = 200 }) {
  const jobId = crypto.randomUUID();
  const combinations = [];
  for (const state of states) {
    for (const niche of niches) {
      combinations.push({ state, niche });
    }
  }

  jobs.set(jobId, {
    id: jobId,
    status: "queued",
    progress: 0,
    totalCombinations: combinations.length,
    completedCombinations: 0,
    statusText: "Queued",
    leadCount: 0,
    targetLeads,
    selectedStates: states.length,
    selectedNiches: niches.length,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
  jobLeads.set(jobId, []);

  runJob(jobId, combinations, targetLeads).catch((error) => {
    upsertJobProgress(jobId, "failed", 100, 0, combinations.length, `Failed: ${error.message}`);
  });

  return jobId;
}

async function runJob(jobId, combinations, targetLeads) {
  if (combinations.length === 0) {
    upsertJobProgress(jobId, "completed", 100, 0, 0, "No combinations selected.");
    return;
  }

  let completed = 0;
  upsertJobProgress(jobId, "running", 1, completed, combinations.length, "Starting lead generation...", 0);
  const collected = [];
  let stopRequested = false;

  await Promise.all(
    combinations.map((combo) =>
      comboQueue.add(async () => {
        if (stopRequested) return;

        const statusText = `Searching ${combo.state} ${combo.niche}...`;
        upsertJobProgress(
          jobId,
          "running",
          Math.round((completed / combinations.length) * 100),
          completed,
          combinations.length,
          `${statusText} (${collected.length}/${targetLeads})`,
          collected.length
        );

        const foundBusinesses = await googleQueue.add(() => searchGooglePlaces(combo));
        if (stopRequested) return;

        await Promise.all(
          foundBusinesses.map((business) =>
            crawlerQueue.add(async () => {
              if (stopRequested) return;
              const email = await discoverEmailForBusiness(business);
              if (stopRequested) return;
              collected.push({
                ...business,
                email: email || "",
                jobId,
                timestamp: nowIso()
              });
              if (collected.length >= targetLeads) {
                stopRequested = true;
              }
            })
          )
        );

        completed += 1;
        upsertJobProgress(
          jobId,
          "running",
          Math.round((completed / combinations.length) * 100),
          completed,
          combinations.length,
          `${statusText} ${foundBusinesses.length} found (${Math.min(collected.length, targetLeads)}/${targetLeads})`,
          Math.min(collected.length, targetLeads)
        );
      })
    )
  );

  const deduped = dedupeByNameAndWebsite(collected).slice(0, targetLeads);
  jobLeads.set(jobId, deduped);

  upsertJobProgress(
    jobId,
    "completed",
    100,
    combinations.length,
    combinations.length,
    `Completed. ${deduped.length} leads found.`,
    deduped.length
  );
}
