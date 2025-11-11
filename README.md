# RevOps Calendar App

Lightweight calendar management interface for The Technical RevOps Partner content automation system.

## Features

- View content calendar statistics
- Approve/decline AI-suggested keywords
- Trigger "Generate Now" workflows
- Filter and sort pending approvals
- Data source tracking (DataForSEO vs Claude AI)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your Supabase credentials

3. Start dev server:
```bash
npm run dev
```

## Deployment

Automatically deploys to Vercel on push to main branch.

## Environment Variables

Required in Vercel:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
