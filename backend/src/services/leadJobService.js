import crypto from "node:crypto";
import PQueue from "p-queue";
import { env } from "../config/env.js";
import { dedupeByNameAndWebsite } from "../utils/helpers.js";
import { discoverEmailForBusiness, searchGooglePlaces } from "./providers.js";
import { consumeJobLeads as consumeStoredJobLeads, getJob, saveJob, saveJobLeads } from "./jobStore.js";

const googleQueue = new PQueue({
  intervalCap: env.maxGoogleQps,
  interval: 1000,
  concurrency: 20
});

const crawlerQueue = new PQueue({ concurrency: 50 });
const comboQueue = new PQueue({ concurrency: 8 });

const nowIso = () => new Date().toISOString();

async function upsertJobProgress(
  jobId,
  status,
  progress,
  completed,
  total,
  statusText,
  leadCount = 0,
  meta = {}
) {
  const current = await getJob(jobId);
  if (!current) return;
  await saveJob({
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

export async function getJobStatus(jobId) {
  return getJob(jobId);
}

export async function consumeJobLeads(jobId) {
  return consumeStoredJobLeads(jobId);
}

export async function createLeadJob({ states, niches, targetLeads = 200 }) {
  const jobId = crypto.randomUUID();
  const combinations = [];
  for (const state of states) {
    for (const niche of niches) {
      combinations.push({ state, niche });
    }
  }

  await saveJob({
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
  await saveJobLeads(jobId, []);

  return jobId;
}

export async function runLeadJob(jobId, states, niches, targetLeads) {
  const combinations = [];
  for (const state of states) {
    for (const niche of niches) {
      combinations.push({ state, niche });
    }
  }

  if (combinations.length === 0) {
    await upsertJobProgress(jobId, "completed", 100, 0, 0, "No combinations selected.");
    return;
  }

  let completed = 0;
  await upsertJobProgress(jobId, "running", 1, completed, combinations.length, "Starting lead generation...", 0);
  const collected = [];
  let stopRequested = false;

  await Promise.all(
    combinations.map((combo) =>
      comboQueue.add(async () => {
        if (stopRequested) return;

        const statusText = `Searching ${combo.state} ${combo.niche}...`;
        await upsertJobProgress(
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
        await upsertJobProgress(
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
  await saveJobLeads(jobId, deduped);

  await upsertJobProgress(
    jobId,
    "completed",
    100,
    combinations.length,
    combinations.length,
    `Completed. ${deduped.length} leads found.`,
    deduped.length
  );
}

export async function failLeadJob(jobId, totalCombinations, errorMessage) {
  await upsertJobProgress(jobId, "failed", 100, 0, totalCombinations, `Failed: ${errorMessage}`);
}
