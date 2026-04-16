# Lead Generation App

Production-ready full-stack lead generation dashboard for home service businesses in:
- New Jersey
- Pennsylvania
- Ohio
- New York
- Delaware
- Maryland

## Stack
- Frontend: React + Tailwind CSS
- Backend: Node.js + Express
- Data flow: persistent per-job leads via Vercel KV/Upstash Redis with memory fallback for local dev
- Queueing/rate limiting: `p-queue`
- CSV export: Papa Parse

## Setup
1. Copy `.env.example` to `.env` and add API keys.
2. Install dependencies:
   - `npm install`
3. Start backend:
   - `npm run dev --workspace backend`
4. Start frontend:
   - `npm run dev --workspace frontend`

## API
- `POST /api/leads/generate`
- `GET /api/leads/status/:jobId`
- `GET /api/leads/export/:jobId`

## Vercel Deployment
This repository is configured for direct Vercel deployment:
- Static frontend output: `frontend/dist`
- Serverless API entrypoint: `api/index.js`
- Routing config: `vercel.json`

Set these environment variables in Vercel Project Settings:
- `GOOGLE_PLACES_API_KEY` (required)
- `SERPAPI_API_KEY` (optional)
- `HUNTER_API_KEY` (optional)
- `MAX_GOOGLE_QPS` (optional)
- `WEBSITE_CRAWL_DELAY_MS` (optional)
- `KV_REST_API_URL` (required for stable serverless job status)
- `KV_REST_API_TOKEN` (required for stable serverless job status)

Optional:
- `FRONTEND_ORIGIN` (if you want strict CORS origin pinning)
- `VITE_API_BASE_URL` (leave empty to use same-origin `/api/leads`)
