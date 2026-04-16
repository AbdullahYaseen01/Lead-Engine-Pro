import { kv } from "@vercel/kv";

const memoryJobs = new Map();
const memoryLeads = new Map();
const JOB_TTL_SECONDS = 60 * 60 * 6;

const hasKvConfig = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const jobKey = (jobId) => `lead-job:${jobId}`;
const leadsKey = (jobId) => `lead-job-leads:${jobId}`;

export async function saveJob(job) {
  if (hasKvConfig) {
    await kv.set(jobKey(job.id), job, { ex: JOB_TTL_SECONDS });
    return;
  }
  memoryJobs.set(job.id, job);
}

export async function getJob(jobId) {
  if (hasKvConfig) {
    return kv.get(jobKey(jobId));
  }
  return memoryJobs.get(jobId) || null;
}

export async function saveJobLeads(jobId, leads) {
  if (hasKvConfig) {
    await kv.set(leadsKey(jobId), leads, { ex: JOB_TTL_SECONDS });
    return;
  }
  memoryLeads.set(jobId, leads);
}

export async function consumeJobLeads(jobId) {
  if (hasKvConfig) {
    const leads = (await kv.get(leadsKey(jobId))) || [];
    await kv.del(leadsKey(jobId));
    return leads;
  }
  const leads = memoryLeads.get(jobId) || [];
  memoryLeads.delete(jobId);
  return leads;
}
