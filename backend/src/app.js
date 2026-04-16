import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import leadsRouter from "./routes/leads.js";

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin || true
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/leads", leadsRouter);

export default app;
