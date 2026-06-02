# PsychoBot Dashboard - Setup Guide

## Overview

The PsychoBot Dashboard is a React + Express application that provides a web-based interface for managing job searches, tracking applications, and interview preparation.

## Architecture

```
┌─────────────────────────────────────────┐
│  React Frontend (Port 3000)              │
│  - Dashboard, JobSearch, Batch, etc.     │
└──────────────┬──────────────────────────┘
               │ HTTP/REST API
┌──────────────▼──────────────────────────┐
│  Express API Server (Port 3001)          │
│  - /api/jobs/*, /api/batch/*, etc.      │
└──────────────┬──────────────────────────┘
               │ Service Layer
┌──────────────▼──────────────────────────┐
│  PsychoBot Services                      │
│  - profileMatcher.js                     │
│  - batchProcessorService.js              │
│  - followUpService.js                    │
│  - interviewPrepService.js               │
└──────────────────────────────────────────┘
```

## Installation

### Prerequisites
- Node.js 14+
- npm or yarn

### Backend Setup

1. Install main dependencies:
```bash
cd D:/Dev/Depot\ Github/Psychobot
npm install express cors axios
```

2. Start the API server:
```bash
node api-server.js
```

You should see:
```
[API] ✅ Server running on http://localhost:3001
[API] API endpoints available at http://localhost:3001/api
```

### Frontend Setup

1. Install React dependencies:
```bash
cd frontend
npm install
```

2. Build the React app:
```bash
npm run build
```

This creates an optimized build in `frontend/build/`

3. Start the app (from backend):
- The API server serves the React app at `http://localhost:3001`
- You can also run development server: `npm start` from frontend directory

## API Endpoints

### Jobs
- `GET /api/jobs/search?keywords=Python&limit=10` - Search jobs
- `GET /api/jobs/daily` - Get cached daily jobs
- `GET /api/jobs/:index` - Get job details
- `POST /api/jobs/score` - Score a job

### Batch Processing
- `POST /api/batch/process` - Process batch of jobs

### Tracking
- `GET /api/track/suggestions` - Get follow-up suggestions
- `GET /api/track/applications` - Get all applications
- `POST /api/track/add` - Add application
- `POST /api/track/status` - Update application status

### Interview Prep
- `GET /api/prep/stories` - Get all stories
- `POST /api/prep/add` - Add new story
- `GET /api/prep/stories/role/:jobIndex` - Get relevant stories for job

### Profile & Stats
- `GET /api/profile` - Get candidate profile
- `GET /api/stats` - Get overall statistics

## Features

### Dashboard
- 📊 Overview of applications by status
- 📈 Conversion rates and pipeline metrics
- 🚀 Quick action buttons to navigate features

### Job Search
- 🔍 Real-time search with Career-Ops scoring
- 📊 A-F rating for each job
- 📈 Visual scoring dimensions
- 💼 Link to apply directly

### Batch Processing
- ⚡ Process 50+ offers at once
- 🎯 Parallel evaluation with 10-dimension scoring
- 📥 CSV export of results

### Application Tracker
- 📋 View all applications with status
- 📞 Follow-up suggestions (7d, 14d, 21d, 30d)
- 📊 Pipeline stage breakdown
- 🎯 Conversion rate tracking

### Interview Prep
- 🎓 STAR story bank
- 🎯 Role-based story relevance
- 💡 Add and manage interview stories

## Deployment

### Local Production Build
```bash
cd frontend
npm run build

# Then from root directory:
node api-server.js
```

Visit `http://localhost:3001` to access the dashboard.

### Render Deployment

1. Push to GitHub:
```bash
git add -A
git commit -m "Add web dashboard"
git push
```

2. Create Render service:
- Connect GitHub repo
- Build command: `cd frontend && npm install && npm run build && cd ..`
- Start command: `node api-server.js`
- Env: `API_PORT=3000` (default)

3. Access dashboard at `https://your-app.onrender.com`

## Environment Variables

```bash
API_PORT=3001          # API server port (default: 3001)
NODE_ENV=production    # Environment mode
```

## Performance Tips

- Build is optimized with React production mode
- Recharts handles large datasets efficiently
- API caches job scores to avoid recomputation
- Parallel batch processing uses 5 workers max

## Troubleshooting

### "Cannot find module 'cors'"
```bash
npm install cors
```

### "Port 3001 already in use"
```bash
# On Windows:
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# On macOS/Linux:
lsof -i :3001
kill -9 <PID>
```

### React app not loading
- Ensure frontend is built: `npm run build` in frontend directory
- API server must be running: `node api-server.js`
- Check browser console for errors

## Development

### Running in Development Mode

Terminal 1 - Backend:
```bash
npm install cors
node api-server.js
```

Terminal 2 - Frontend (optional, for hot reload):
```bash
cd frontend
npm install
npm start
```

Access dashboard at `http://localhost:3000` (if using `npm start`)

### Modifying Components

1. Edit components in `frontend/src/components/`
2. Changes auto-reload if using `npm start`
3. Rebuild production: `npm run build`

## Next Steps

- Connect dashboard to WhatsApp bot for real-time sync
- Add WebSocket for live updates
- Integrate with calendar for interview scheduling
- Add company research and salary data
