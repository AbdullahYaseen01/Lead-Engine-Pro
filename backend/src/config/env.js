import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const env = {
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "",
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || "",
  serpApiKey: process.env.SERPAPI_API_KEY || "",
  hunterApiKey: process.env.HUNTER_API_KEY || "",
  maxGoogleQps: Number(process.env.MAX_GOOGLE_QPS || 10),
  websiteCrawlDelayMs: Number(process.env.WEBSITE_CRAWL_DELAY_MS || 1250)
};
