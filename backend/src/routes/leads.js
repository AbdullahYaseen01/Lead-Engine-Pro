import express from "express";
import Papa from "papaparse";
import { waitUntil } from "@vercel/functions";
import {
  consumeJobLeads,
  createLeadJob,
  failLeadJob,
  getJobStatus,
  runLeadJob
} from "../services/leadJobService.js";

const router = express.Router();

router.post("/generate", async (req, res) => {
  const { niches = [], states = [], targetLeads = 200 } = req.body || {};
  if (!Array.isArray(niches) || !Array.isArray(states)) {
    return res.status(400).json({ error: "niches and states must be arrays" });
  }
  const parsedTarget = Math.max(10, Math.min(Number(targetLeads) || 200, 5000));
  const jobId = await createLeadJob({ niches, states, targetLeads: parsedTarget });
  const totalCombinations = niches.length * states.length;
  const task = runLeadJob(jobId, states, niches, parsedTarget).catch((error) =>
    failLeadJob(jobId, totalCombinations, error.message)
  );
  try {
    waitUntil(task);
  } catch {
    task.catch(() => {});
  }
  return res.status(202).json({ jobId });
});

router.get("/status/:jobId", async (req, res) => {
  const row = await getJobStatus(req.params.jobId);
  if (!row) return res.status(404).json({ error: "Job not found" });

  return res.json({
    id: row.id,
    status: row.status,
    progress: row.progress,
    statusText: row.statusText,
    totalCombinations: row.totalCombinations,
    completedCombinations: row.completedCombinations,
    leadCount: row.leadCount || 0,
    targetLeads: row.targetLeads || 0,
    selectedStates: row.selectedStates || 0,
    selectedNiches: row.selectedNiches || 0,
    updatedAt: row.updatedAt
  });
});

router.get("/export/:jobId", async (req, res) => {
  const records = await consumeJobLeads(req.params.jobId);
  if (!records.length) {
    return res.status(404).json({ error: "No leads ready for this job." });
  }
  const csvRows = records.map((row) => ({
    "Business Name": row.businessName || "",
    Email: row.email || "",
    "Website Link": row.websiteLink || "",
    Category: row.category || ""
  }));
  const csv = Papa.unparse(csvRows, {
    columns: ["Business Name", "Email", "Website Link", "Category"]
  });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="leads.csv"');
  return res.send(csv);
});

export default router;
