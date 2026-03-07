# Careercraft

Careercraft is a role-based learning platform with:
- JWT authentication
- MySQL user/progress storage
- AI mentor chat integration
- Progress dashboard and path tracking

## Run locally
1. Open terminal in `ai-ascend/server`
2. Install dependencies:
   - `npm install`
3. Create `.env` from `.env.example`:
   - `copy .env.example .env` (Windows)
4. Create MySQL database:
   - `mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS ai_ascend;"`
5. Import schema:
   - `mysql -u root -p ai_ascend < sql/schema.sql`
6. Update `.env` values:
   - `JWT_SECRET`
   - `GROQ_API_KEY` (recommended free-tier primary provider)
   - `GROQ_MODEL` (optional, default: `llama-3.1-8b-instant`)
   - `GEMINI_API_KEY`
   - `OPENAI_API_KEY` (optional fallback)
   - `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
7. Start server:
   - `npm run dev`
8. Open:
   - `http://localhost:3000`

## What is included
- JWT-based auth (`/api/auth/signup`, `/api/auth/login`, `/api/auth/me`)
- Protected routes for progress and chat APIs
- Learning path search + level filter
- Progress tracking (`watch` + `complete path`) with dashboard stats
- Chatbot backend proxy to keep API keys off frontend
- MySQL-backed user, progress, and chat memory storage
- AI personalized learning path generator (`/api/ai/path/generate`, `personalized-path.html`)
- AI skill gap analyzer (`/api/ai/skill-gap/analyze`, `skill-gap.html`)
  - Includes optional resume PDF upload that auto-fills resume text before analysis
  - Includes ATS score + resume optimization suggestions for target role/JD
- AI career recommendation quiz (`/api/ai/career-recommend`, `career-quiz.html`)
  - Triggered immediately after login before dashboard
- AI subject flashcard + quiz generator (`/api/ai/quiz/generate`, `learn.html`)
  - Builds from YouTube transcript content (captions required)
- Gamified learning system (`/api/gamification/summary`, `dashboard.html`)
  - XP points, streak tracking, badges, and leaderboard
- Smart progress prediction (`/api/progress/prediction`, `learn.html`)
  - ETA to complete path + pace-drop alert + suggested videos/day
- Weekly study planner (`/api/study-planner/*`, `dashboard.html`)
  - Monday-Sunday calendar, add/edit/delete tasks, status tracking, reminders, weekly stats, and Google/Outlook sync links

## GitHub publish checklist
1. Ensure your real secrets are only in `server/.env` (never commit this file).
2. Keep `server/.env.example` with placeholder values only.
3. Rotate API keys if they were ever shared publicly.
4. Commit and push:
   - `git init`
   - `git add .`
   - `git commit -m "Initial commit: Careercraft platform"`
   - `git branch -M main`
   - `git remote add origin <your-repo-url>`
   - `git push -u origin main`
