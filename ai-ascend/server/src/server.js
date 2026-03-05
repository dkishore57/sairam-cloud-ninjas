import path from "path"
import { fileURLToPath } from "url"
import crypto from "crypto"
import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { PATHS, PATHS_BY_ID } from "../../data/paths.js"
import { dbQuery, initDatabase, pool } from "./mysql.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || "unsafe_default_secret"
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash"
let resolvedGeminiModel = GEMINI_MODEL

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.join(__dirname, "..", "..")

app.use(cors())
app.use(express.json({ limit: "1mb" }))
app.use(express.static(PROJECT_ROOT))

function toPublicUser(user){
  return {
    id: user.id,
    name: user.name,
    email: user.email
  }
}

function createToken(user){
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" })
}

function extractRetryAfterSec(message){
  if(typeof message !== "string"){
    return null
  }
  const match = message.match(/retry in\s+([\d.]+)s/i)
  if(!match){
    return null
  }
  const value = Number(match[1])
  if(Number.isNaN(value)){
    return null
  }
  return Math.max(1, Math.ceil(value))
}

function buildProgress(videoRows, completionRows){
  const watched = {}
  for(const row of videoRows){
    watched[row.path_id] = watched[row.path_id] || []
    watched[row.path_id].push(row.video_id)
  }
  const completed = completionRows.map(row => row.path_id)
  return { watched, completed }
}

function buildStats(progress){
  const totalVideos = PATHS.reduce((sum, path) => sum + path.videos.length, 0)
  const watchedVideos = Object.values(progress.watched).reduce((sum, ids) => sum + ids.length, 0)
  const remainingVideos = Math.max(0, totalVideos - watchedVideos)
  const completedPaths = progress.completed.length
  const totalPaths = PATHS.length
  return { totalVideos, watchedVideos, remainingVideos, completedPaths, totalPaths }
}

async function getProgressByUserId(userId){
  const [videoRows, completionRows] = await Promise.all([
    dbQuery(
      "SELECT path_id, video_id FROM user_video_progress WHERE user_id = ? ORDER BY watched_at ASC",
      [userId]
    ),
    dbQuery(
      "SELECT path_id FROM user_path_completion WHERE user_id = ? ORDER BY completed_at ASC",
      [userId]
    )
  ])
  const progress = buildProgress(videoRows, completionRows)
  const stats = buildStats(progress)
  return { progress, stats }
}

async function authMiddleware(req, res, next){
  const auth = req.headers.authorization || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if(!token){
    return res.status(401).json({ message: "Unauthorized" })
  }

  try{
    const decoded = jwt.verify(token, JWT_SECRET)
    const rows = await dbQuery("SELECT id, name, email FROM users WHERE id = ? LIMIT 1", [decoded.sub])
    const user = rows[0]
    if(!user){
      return res.status(401).json({ message: "Unauthorized" })
    }
    req.user = user
    next()
  }catch(_error){
    return res.status(401).json({ message: "Unauthorized" })
  }
}

async function resolveGeminiModel(){
  if(!process.env.GEMINI_API_KEY){
    return GEMINI_MODEL
  }

  try{
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    )
    const data = await response.json().catch(() => ({}))
    const models = Array.isArray(data.models) ? data.models : []
    const generateModels = models.filter(model =>
      Array.isArray(model.supportedGenerationMethods) &&
      model.supportedGenerationMethods.includes("generateContent")
    )

    const preferredNames = [
      GEMINI_MODEL,
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-pro"
    ]

    for(const preferred of preferredNames){
      const exact = generateModels.find(model => model.name === `models/${preferred}`)
      if(exact){
        return preferred
      }
    }

    if(generateModels.length > 0){
      return generateModels[0].name.replace("models/", "")
    }
  }catch(_error){
    // Ignore and keep fallback.
  }

  return GEMINI_MODEL
}

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body || {}
  if(!name || !email || typeof password !== "string" || password.length < 6){
    return res.status(400).json({ message: "Invalid signup payload" })
  }

  const lowerEmail = email.trim().toLowerCase()
  const existing = await dbQuery("SELECT id FROM users WHERE email = ? LIMIT 1", [lowerEmail])
  if(existing.length > 0){
    return res.status(409).json({ message: "Email already registered" })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: lowerEmail,
    passwordHash
  }

  await dbQuery(
    "INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)",
    [user.id, user.name, user.email, user.passwordHash]
  )

  return res.status(201).json({ user: toPublicUser(user) })
})

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {}
  if(!email || !password){
    return res.status(400).json({ message: "Email and password are required" })
  }

  const rows = await dbQuery(
    "SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1",
    [email.toLowerCase()]
  )
  const user = rows[0]
  if(!user){
    return res.status(401).json({ message: "Invalid credentials" })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if(!valid){
    return res.status(401).json({ message: "Invalid credentials" })
  }

  return res.json({
    token: createToken(user),
    user: toPublicUser(user)
  })
})

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  res.json({ user: toPublicUser(req.user) })
})

app.get("/api/progress", authMiddleware, async (req, res) => {
  const data = await getProgressByUserId(req.user.id)
  res.json(data)
})

app.post("/api/progress/watch", authMiddleware, async (req, res) => {
  const { pathId, videoId } = req.body || {}
  if(!pathId || !videoId){
    return res.status(400).json({ message: "pathId and videoId are required" })
  }

  const selectedPath = PATHS_BY_ID[pathId]
  if(!selectedPath){
    return res.status(404).json({ message: "Invalid path" })
  }

  const existsInPath = selectedPath.videos.some(video => video.id === videoId)
  if(!existsInPath){
    return res.status(404).json({ message: "Invalid video for this path" })
  }

  await dbQuery(
    "INSERT IGNORE INTO user_video_progress (user_id, path_id, video_id) VALUES (?, ?, ?)",
    [req.user.id, pathId, videoId]
  )

  const data = await getProgressByUserId(req.user.id)
  return res.json(data)
})

app.post("/api/progress/complete", authMiddleware, async (req, res) => {
  const { pathId } = req.body || {}
  if(!pathId){
    return res.status(400).json({ message: "pathId is required" })
  }

  const selectedPath = PATHS_BY_ID[pathId]
  if(!selectedPath){
    return res.status(404).json({ message: "Invalid path" })
  }

  const watchedRows = await dbQuery(
    "SELECT COUNT(*) AS count FROM user_video_progress WHERE user_id = ? AND path_id = ?",
    [req.user.id, pathId]
  )
  const watchedCount = Number(watchedRows[0]?.count || 0)
  if(watchedCount < selectedPath.videos.length){
    return res.status(400).json({ message: "Watch all videos before completing this path" })
  }

  await dbQuery(
    "INSERT IGNORE INTO user_path_completion (user_id, path_id) VALUES (?, ?)",
    [req.user.id, pathId]
  )

  const data = await getProgressByUserId(req.user.id)
  return res.json(data)
})

app.get("/api/chat/history", authMiddleware, async (req, res) => {
  const rows = await dbQuery(
    "SELECT role, text, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
    [req.user.id]
  )
  const history = rows.reverse().map(row => ({
    role: row.role,
    text: row.text,
    createdAt: row.created_at
  }))
  res.json({ history })
})

app.delete("/api/chat/history", authMiddleware, async (req, res) => {
  await dbQuery("DELETE FROM chat_messages WHERE user_id = ?", [req.user.id])
  res.json({ history: [] })
})

app.post("/api/chat", authMiddleware, async (req, res) => {
  const { question } = req.body || {}
  if(!question || typeof question !== "string"){
    return res.status(400).json({ message: "Question is required" })
  }

  if(!process.env.GEMINI_API_KEY){
    return res.status(500).json({ message: "Missing GEMINI_API_KEY in server environment" })
  }

  const priorRows = await dbQuery(
    "SELECT role, text FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 12",
    [req.user.id]
  )
  const priorHistory = priorRows.reverse()
  const contents = [...priorHistory, { role: "user", text: question }]
    .filter(item => item && item.text)
    .map(item => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.text }]
    }))

  try{
    const modelToUse = resolvedGeminiModel || GEMINI_MODEL
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
      }
    )

    const data = await response.json().catch(() => ({}))
    if(!response.ok){
      const upstreamMessage = data?.error?.message || "AI service request failed"
      const isQuotaError = response.status === 429 || /quota exceeded/i.test(upstreamMessage)
      if(isQuotaError){
        const retryAfterSec = extractRetryAfterSec(upstreamMessage)
        return res.status(429).json({
          code: "quota_exceeded",
          message: retryAfterSec
            ? `AI quota exceeded. Please retry in ${retryAfterSec}s or upgrade billing.`
            : "AI quota exceeded. Please retry later or upgrade billing.",
          retryAfterSec
        })
      }
      return res.status(502).json({ code: "upstream_error", message: upstreamMessage })
    }

    const answer = (data?.candidates?.[0]?.content?.parts || [])
      .map(part => part?.text || "")
      .join("")
      .trim()

    if(!answer){
      const blockReason = data?.promptFeedback?.blockReason
      if(blockReason){
        return res.status(400).json({ message: `Blocked by AI safety filter: ${blockReason}` })
      }
      return res.status(502).json({ message: "AI service returned an empty response" })
    }

    await dbQuery(
      "INSERT INTO chat_messages (user_id, role, text) VALUES (?, ?, ?), (?, ?, ?)",
      [req.user.id, "user", question, req.user.id, "assistant", answer]
    )

    const historyRows = await dbQuery(
      "SELECT role, text, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
      [req.user.id]
    )
    const history = historyRows.reverse().map(row => ({
      role: row.role,
      text: row.text,
      createdAt: row.created_at
    }))

    return res.json({ answer, history })
  }catch(_error){
    return res.status(502).json({ message: "Unable to connect to AI service" })
  }
})

app.get("*", (_req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, "index.html"))
})

async function start(){
  await initDatabase()
  app.listen(PORT, () => {
    console.log(`AI Ascend server running on http://localhost:${PORT}`)
  })
  resolveGeminiModel().then(model => {
    resolvedGeminiModel = model
    console.log(`Gemini model selected: ${resolvedGeminiModel}`)
  })
}

start().catch(error => {
  console.error("Failed to initialize database:", error.message)
  process.exit(1)
})

process.on("SIGINT", async () => {
  await pool.end()
  process.exit(0)
})
