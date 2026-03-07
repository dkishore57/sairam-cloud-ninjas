# Career Craft

Career Craft is a role-based learning platform with:
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
   - `GEMINI_API_KEY`
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

## GitHub publish checklist
1. Ensure your real secrets are only in `server/.env` (never commit this file).
2. Keep `server/.env.example` with placeholder values only.
3. Rotate API keys if they were ever shared publicly.
4. Commit and push:
   - `git init`
   - `git add .`
   - `git commit -m "Initial commit: Career Craft platform"`
   - `git branch -M main`
   - `git remote add origin <your-repo-url>`
   - `git push -u origin main`
