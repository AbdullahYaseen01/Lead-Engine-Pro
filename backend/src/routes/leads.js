import express from "express";
import Papa from "papaparse";
import { formatPhoneWithUsCountryCode } from "../utils/helpers.js";
import { generateLeadRows } from "../services/leadJobService.js";

const router = express.Router();

router.post("/generate", async (req, res) => {
  const { niches = [], states = [], targetLeads = 200 } = req.body || {};
  if (!Array.isArray(niches) || !Array.isArray(states)) {
    return res.status(400).json({ error: "niches and states must be arrays" });
  }
  const parsedTarget = Math.max(10, Math.min(Number(targetLeads) || 200, 5000));
  const records = await generateLeadRows({ niches, states, targetLeads: parsedTarget });
  const csvRows = records.map((row) => ({
    "Business Name": row.businessName || "",
    Email: row.email || "",
    Phone: formatPhoneWithUsCountryCode(row.phoneNumber),
    "Website Link": row.websiteLink || "",
    Category: row.category || ""
  }));
  const csv = Papa.unparse(csvRows, {
    columns: ["Business Name", "Email", "Phone", "Website Link", "Category"]
  });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="leads.csv"');
  return res.send(csv);
});

export default router;
