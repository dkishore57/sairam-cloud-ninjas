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

function buildPathMentorContext(path){
  const topTags = (path.tags || []).slice(0, 8).join(", ")
  const topics = (path.videos || [])
    .slice(0, 12)
    .map(video => video.title)
    .join("; ")

  return [
    "You are AI Mentor for Career Craft.",
    `Active learning domain: ${path.title}.`,
    `Role focus: ${path.role}.`,
    `Difficulty level: ${path.level}.`,
    `Domain summary: ${path.description}`,
    topTags ? `Key concepts: ${topTags}.` : "",
    topics ? `Learning path topics include: ${topics}.` : "",
    "Always anchor answers to this active domain unless the user explicitly asks to switch domains.",
    "Prefer practical, step-by-step guidance and concise examples relevant to this domain."
  ]
    .filter(Boolean)
    .join(" ")
}

function buildContextualQuestion(path, question){
  return [
    `Domain: ${path.title} (${path.level})`,
    `Role: ${path.role}`,
    `Description: ${path.description}`,
    `User question: ${question}`
  ].join("\n")
}

function parseJsonFromText(text){
  if(typeof text !== "string" || !text.trim()){
    return null
  }

  try{
    return JSON.parse(text)
  }catch(_error){
    // Continue with fenced/plain block extraction.
  }

  const first = text.indexOf("{")
  const last = text.lastIndexOf("}")
  if(first >= 0 && last > first){
    const slice = text.slice(first, last + 1)
    try{
      return JSON.parse(slice)
    }catch(_error){
      return null
    }
  }

  return null
}

function normalizeRoadmap(raw){
  const fallback = {
    summary: "Custom roadmap generated.",
    estimatedCompletion: "4 months",
    timeline: []
  }
  if(!raw || typeof raw !== "object"){
    return fallback
  }

  const timeline = Array.isArray(raw.timeline)
    ? raw.timeline
      .map(item => ({
        phase: String(item?.phase || "").trim(),
        focus: String(item?.focus || "").trim(),
        resources: Array.isArray(item?.resources) ? item.resources.map(v => String(v).trim()).filter(Boolean).slice(0, 6) : [],
        outcomes: Array.isArray(item?.outcomes) ? item.outcomes.map(v => String(v).trim()).filter(Boolean).slice(0, 6) : []
      }))
      .filter(item => item.phase && item.focus)
    : []

  return {
    summary: String(raw.summary || fallback.summary).trim(),
    estimatedCompletion: String(raw.estimatedCompletion || fallback.estimatedCompletion).trim(),
    timeline
  }
}

function normalizeFlashcards(raw){
  const cards = Array.isArray(raw?.cards)
    ? raw.cards
      .map(item => ({
        question: String(item?.question || "").trim(),
        hint: String(item?.hint || "").trim(),
        answer: String(item?.answer || "").trim()
      }))
      .filter(item => item.question && item.answer)
      .slice(0, 12)
    : []
  return cards
}

function fallbackFlashcards(path, watchedTitles = []){
  const topics = (watchedTitles.length > 0 ? watchedTitles : path.videos.map(video => video.title)).slice(0, 8)
  if(topics.length === 0){
    return []
  }
  return topics.map(topic => ({
    question: `What is ${topic} and why is it useful in ${path.title}?`,
    hint: `Think about where ${topic} fits in practical workflows.`,
    answer: `${topic} is a core concept in ${path.title}. Focus on definition, use cases, and one practical implementation example.`
  }))
}

const TECH_SKILLS = [
  "python", "javascript", "typescript", "java", "go", "c++", "sql", "mongodb", "mysql",
  "postgresql", "redis", "docker", "kubernetes", "linux", "git", "github actions",
  "terraform", "aws", "azure", "gcp", "node.js", "express", "react", "html", "css",
  "rest api", "graphql", "microservices", "system design", "api security", "oauth",
  "jwt", "data structures", "algorithms", "ci/cd", "testing", "unit testing", "cybersecurity",
  "ethical hacking", "penetration testing", "kali linux", "siem", "soc", "ids", "ips", "cryptography",
  "machine learning", "deep learning", "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "keras", "nlp", "computer vision", "mlops"
]

const ROLE_SKILL_BASELINES = {
  "backend developer": ["node.js", "express", "sql", "mongodb", "redis", "docker", "system design", "api security", "jwt", "testing"],
  "frontend developer": ["html", "css", "javascript", "typescript", "react", "rest api", "testing", "git"],
  "devops engineer": ["linux", "docker", "kubernetes", "terraform", "aws", "ci/cd", "github actions", "system design"],
  "cloud engineer": ["aws", "azure", "gcp", "terraform", "docker", "kubernetes", "linux", "ci/cd"],
  "cybersecurity engineer": ["network security", "linux", "python", "ethical hacking", "penetration testing", "cryptography", "siem", "soc", "cloud security"],
  "ai/ml engineer": ["python", "machine learning", "deep learning", "nlp", "computer vision", "tensorflow", "pytorch", "mlops"],
  "data scientist": ["python", "sql", "pandas", "numpy", "scikit-learn", "machine learning", "deep learning"],
  "software developer": ["javascript", "python", "sql", "git", "testing", "rest api", "data structures", "algorithms"]
}

function normalizeSkillName(skill){
  return String(skill || "")
    .toLowerCase()
    .replace(/[^\w+.#/\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function formatSkillName(skill){
  return String(skill || "")
    .split(" ")
    .filter(Boolean)
    .map(part => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function extractSkillsFromText(text){
  const lower = String(text || "").toLowerCase()
  const found = new Set()
  for(const skill of TECH_SKILLS){
    if(lower.includes(skill)){
      found.add(skill)
    }
  }
  return found
}

function extractLinkedInSkills(linkedinSkills){
  if(Array.isArray(linkedinSkills)){
    return linkedinSkills.map(normalizeSkillName).filter(Boolean)
  }
  return String(linkedinSkills || "")
    .split(/[,\n|]/)
    .map(normalizeSkillName)
    .filter(Boolean)
}

function inferTargetRole({ targetRole, resumeText, jobDescriptions }){
  const explicit = String(targetRole || "").trim()
  if(explicit){
    return explicit
  }

  const source = `${String(resumeText || "")}\n${String(jobDescriptions || "")}`.toLowerCase()
  const checks = [
    { pattern: /data scientist|machine learning engineer/, role: "Data Scientist" },
    { pattern: /backend|api developer|server-side/, role: "Backend Developer" },
    { pattern: /frontend|front-end|ui developer/, role: "Frontend Developer" },
    { pattern: /devops|site reliability|sre/, role: "DevOps Engineer" },
    { pattern: /cloud engineer|cloud architect/, role: "Cloud Engineer" }
    ,
    { pattern: /cybersecurity|cyber security|security analyst|ethical hacking|penetration testing|soc/, role: "Cybersecurity Engineer" },
    { pattern: /ai\/ml|ai ml|machine learning engineer|ml engineer|artificial intelligence/, role: "AI/ML Engineer" }
  ]
  const matched = checks.find(item => item.pattern.test(source))
  return matched ? matched.role : "Software Developer"
}

function buildRoleBasedJobDescription(targetRole){
  const normalized = normalizeSkillName(targetRole)
  const baselineEntry = Object.entries(ROLE_SKILL_BASELINES).find(([role]) => normalized.includes(role))
  const baselineSkills = baselineEntry ? baselineEntry[1] : ROLE_SKILL_BASELINES["software developer"]
  return `Typical ${targetRole} requirements: ${baselineSkills.join(", ")}.`
}

function compareSkillSets({ resumeText, linkedinSkills, jobDescriptions }){
  const resumeSkills = extractSkillsFromText(resumeText)
  const jdSkills = extractSkillsFromText(jobDescriptions)
  const linkedinSet = new Set(extractLinkedInSkills(linkedinSkills))
  const userSkills = new Set([...resumeSkills, ...linkedinSet])
  const missingSkills = [...jdSkills].filter(skill => !userSkills.has(skill))
  const existingSkills = [...userSkills].filter(skill => jdSkills.has(skill))
  return {
    missingSkills,
    existingSkills,
    jdSkills: [...jdSkills],
    userSkills: [...userSkills]
  }
}

function recommendPaths({ targetRole, missingSkills }){
  const roleText = normalizeSkillName(targetRole)
  const scored = PATHS.map(path => {
    const pathTokens = new Set([
      normalizeSkillName(path.title),
      normalizeSkillName(path.role),
      ...path.tags.map(normalizeSkillName)
    ])
    let score = 0

    for(const skill of missingSkills){
      if(pathTokens.has(normalizeSkillName(skill))){
        score += 2
      }
    }
    if(roleText.includes(normalizeSkillName(path.title)) || roleText.includes(normalizeSkillName(path.role))){
      score += 3
    }
    return { path, score }
  })
    .sort((a, b) => b.score - a.score)
    .filter(item => item.score > 0)
    .slice(0, 3)

  if(scored.length > 0){
    return scored.map(item => ({
      pathId: item.path.id,
      title: item.path.title,
      reason: `Matches role/skill gaps in ${item.path.tags.slice(0, 3).join(", ")}`
    }))
  }

  return PATHS.slice(0, 2).map(path => ({
    pathId: path.id,
    title: path.title,
    reason: "Strong foundational path for broader coverage"
  }))
}

function normalizeSkillGapResult(raw, fallback){
  if(!raw || typeof raw !== "object"){
    return fallback
  }

  const cleanList = (value, max = 10) => Array.isArray(value)
    ? value.map(item => normalizeSkillName(item)).filter(Boolean).slice(0, max).map(formatSkillName)
    : []

  const aiMissing = cleanList(raw.missingSkills)
  const aiExisting = cleanList(raw.existingStrengths)
  const recommendedLearningPaths = Array.isArray(raw.recommendedLearningPaths)
    ? raw.recommendedLearningPaths
      .map(item => ({
        pathId: normalizeSkillName(item?.pathId || ""),
        title: String(item?.title || "").trim(),
        reason: String(item?.reason || "").trim()
      }))
      .filter(item => item.title)
      .slice(0, 4)
    : fallback.recommendedLearningPaths

  return {
    targetRole: String(raw.targetRole || fallback.targetRole).trim(),
    missingSkills: aiMissing.length > 0 ? aiMissing : fallback.missingSkills,
    existingStrengths: aiExisting.length > 0 ? aiExisting : fallback.existingStrengths,
    recommendedLearningPaths,
    analysis: {
      summary: String(raw?.analysis?.summary || fallback.analysis.summary).trim(),
      next30Days: String(raw?.analysis?.next30Days || fallback.analysis.next30Days).trim()
    },
    analysisMethod: "llm+nlp"
  }
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

function isVideoValidForPath(selectedPath, pathId, videoId){
  const existsInPath = selectedPath.videos.some(video => video.id === videoId)
  if(existsInPath){
    return true
  }
  // Backward-compatible fallback for freshly added videos when client/server metadata is temporarily out of sync.
  return typeof videoId === "string" && videoId.startsWith(`${pathId}-`)
}

function buildBadges(gamification, stats){
  const templates = [
    { id: "first-watch", name: "First Watch", rule: "Watch your first video", unlocked: stats.watchedVideos >= 1 },
    { id: "path-finisher", name: "Path Finisher", rule: "Complete your first path", unlocked: stats.completedPaths >= 1 },
    { id: "xp-500", name: "XP 500", rule: "Reach 500 total XP", unlocked: gamification.xp >= 500 }
  ]
  const unlockedCount = templates.filter(item => item.unlocked).length
  return { unlockedCount, total: templates.length, items: templates }
}

async function getGamificationByUserId(userId){
  const rows = await dbQuery(
    "SELECT xp FROM users WHERE id = ? LIMIT 1",
    [userId]
  )
  const row = rows[0] || {}
  return {
    xp: Number(row.xp || 0)
  }
}

async function applyLearningActivity(userId, xpAward){
  await dbQuery("UPDATE users SET xp = xp + ? WHERE id = ?", [xpAward, userId])
}

async function applyXpDelta(userId, delta){
  await dbQuery(
    "UPDATE users SET xp = GREATEST(0, xp + ?) WHERE id = ?",
    [delta, userId]
  )
}

async function getProgressByUserId(userId){
  const [videoRows, completionRows, gamification] = await Promise.all([
    dbQuery(
      "SELECT path_id, video_id FROM user_video_progress WHERE user_id = ? ORDER BY watched_at ASC",
      [userId]
    ),
    dbQuery(
      "SELECT path_id FROM user_path_completion WHERE user_id = ? ORDER BY completed_at ASC",
      [userId]
    ),
    getGamificationByUserId(userId)
  ])
  const progress = buildProgress(videoRows, completionRows)
  const stats = buildStats(progress)
  const badges = buildBadges(gamification, stats)
  return { progress, stats, gamification, badges }
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

  // Fresh login starts with clean AI mentor history.
  await dbQuery("DELETE FROM chat_messages WHERE user_id = ?", [user.id])

  return res.json({
    token: createToken(user),
    user: toPublicUser(user)
  })
})

app.post("/api/auth/logout", authMiddleware, async (req, res) => {
  await dbQuery("DELETE FROM chat_messages WHERE user_id = ?", [req.user.id])
  res.json({ message: "Logged out and chat history cleared" })
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

  if(!isVideoValidForPath(selectedPath, pathId, videoId)){
    return res.status(404).json({ message: "Invalid video for this path" })
  }

  const writeResult = await dbQuery(
    "INSERT IGNORE INTO user_video_progress (user_id, path_id, video_id) VALUES (?, ?, ?)",
    [req.user.id, pathId, videoId]
  )
  if(Number(writeResult?.affectedRows || 0) > 0){
    await applyLearningActivity(req.user.id, 10)
  }

  const data = await getProgressByUserId(req.user.id)
  return res.json(data)
})

app.post("/api/progress/unwatch", authMiddleware, async (req, res) => {
  const { pathId, videoId } = req.body || {}
  if(!pathId || !videoId){
    return res.status(400).json({ message: "pathId and videoId are required" })
  }

  const selectedPath = PATHS_BY_ID[pathId]
  if(!selectedPath){
    return res.status(404).json({ message: "Invalid path" })
  }

  const videoDeleteResult = await dbQuery(
    "DELETE FROM user_video_progress WHERE user_id = ? AND path_id = ? AND video_id = ?",
    [req.user.id, pathId, videoId]
  )
  if(Number(videoDeleteResult?.affectedRows || 0) > 0){
    await applyXpDelta(req.user.id, -10)
  }

  // If a user marks any video as unwatched, completion for that path should be removed.
  const completionDeleteResult = await dbQuery(
    "DELETE FROM user_path_completion WHERE user_id = ? AND path_id = ?",
    [req.user.id, pathId]
  )
  if(Number(completionDeleteResult?.affectedRows || 0) > 0){
    await applyXpDelta(req.user.id, -200)
  }

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

  const writeResult = await dbQuery(
    "INSERT IGNORE INTO user_path_completion (user_id, path_id) VALUES (?, ?)",
    [req.user.id, pathId]
  )
  if(Number(writeResult?.affectedRows || 0) > 0){
    await applyLearningActivity(req.user.id, 200)
  }

  const data = await getProgressByUserId(req.user.id)
  return res.json(data)
})

app.get("/api/leaderboard", authMiddleware, async (_req, res) => {
  const rows = await dbQuery(
    `SELECT name, xp
     FROM users
     ORDER BY xp DESC, name ASC
     LIMIT 20`
  )
  const leaderboard = rows.map((row, index) => ({
    rank: index + 1,
    name: row.name,
    xp: Number(row.xp || 0)
  }))
  res.json({ leaderboard })
})

app.get("/api/chat/history", authMiddleware, async (req, res) => {
  const pathId = String(req.query.pathId || "").trim() || "frontend"
  if(!PATHS_BY_ID[pathId]){
    return res.status(400).json({ message: "Invalid pathId" })
  }

  const rows = await dbQuery(
    "SELECT role, text, created_at FROM chat_messages WHERE user_id = ? AND path_id = ? ORDER BY created_at DESC LIMIT 30",
    [req.user.id, pathId]
  )
  const history = rows.reverse().map(row => ({
    role: row.role,
    text: row.text,
    createdAt: row.created_at
  }))
  res.json({ history })
})

app.delete("/api/chat/history", authMiddleware, async (req, res) => {
  const pathId = String(req.query.pathId || "").trim()
  if(pathId){
    if(!PATHS_BY_ID[pathId]){
      return res.status(400).json({ message: "Invalid pathId" })
    }
    await dbQuery("DELETE FROM chat_messages WHERE user_id = ? AND path_id = ?", [req.user.id, pathId])
  }else{
    await dbQuery("DELETE FROM chat_messages WHERE user_id = ?", [req.user.id])
  }
  res.json({ history: [] })
})

app.post("/api/chat", authMiddleware, async (req, res) => {
  const { question, pathId } = req.body || {}
  if(!question || typeof question !== "string"){
    return res.status(400).json({ message: "Question is required" })
  }
  if(!pathId || !PATHS_BY_ID[pathId]){
    return res.status(400).json({ message: "Valid pathId is required" })
  }

  if(!process.env.GEMINI_API_KEY){
    return res.status(500).json({ message: "Missing GEMINI_API_KEY in server environment" })
  }

  const priorRows = await dbQuery(
    "SELECT role, text FROM chat_messages WHERE user_id = ? AND path_id = ? ORDER BY created_at DESC LIMIT 12",
    [req.user.id, pathId]
  )
  const selectedPath = PATHS_BY_ID[pathId]
  const systemContext = buildPathMentorContext(selectedPath)
  const contextualQuestion = buildContextualQuestion(selectedPath, question)
  const priorHistory = priorRows.reverse()
  const contents = [...priorHistory, { role: "user", text: contextualQuestion }]
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
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemContext }]
          },
          contents
        })
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
      "INSERT INTO chat_messages (user_id, path_id, role, text) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
      [req.user.id, pathId, "user", question, req.user.id, pathId, "assistant", answer]
    )

    const historyRows = await dbQuery(
      "SELECT role, text, created_at FROM chat_messages WHERE user_id = ? AND path_id = ? ORDER BY created_at DESC LIMIT 30",
      [req.user.id, pathId]
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

app.post("/api/path-generator", authMiddleware, async (req, res) => {
  const { skillLevel, careerGoal, weeklyHours, learningStyle } = req.body || {}
  if(!skillLevel || !careerGoal || !weeklyHours || !learningStyle){
    return res.status(400).json({
      message: "skillLevel, careerGoal, weeklyHours, and learningStyle are required"
    })
  }

  const weeklyHoursNumber = Number(weeklyHours)
  if(Number.isNaN(weeklyHoursNumber) || weeklyHoursNumber < 1 || weeklyHoursNumber > 80){
    return res.status(400).json({ message: "weeklyHours must be a number between 1 and 80" })
  }

  if(!process.env.GEMINI_API_KEY){
    return res.status(500).json({ message: "Missing GEMINI_API_KEY in server environment" })
  }

  const instruction = [
    "You are an expert career mentor generating personalized learning plans.",
    "Return only valid JSON with this exact shape:",
    "{",
    '  "summary": "short paragraph",',
    '  "estimatedCompletion": "string",',
    '  "timeline": [',
    '    {"phase":"Month 1","focus":"...","resources":["..."],"outcomes":["..."]}',
    "  ]",
    "}",
    "Rules:",
    "- Keep timeline practical and sequential.",
    "- Include 4 to 8 phases (month-based).",
    "- Resources should be concrete learning suggestions (course/topic/project type).",
    "- Outcomes should be measurable.",
    "- Use the user's weekly time to estimate completion realistically."
  ].join("\n")

  const userPrompt = [
    `User profile:`,
    `- Current skill level: ${String(skillLevel).trim()}`,
    `- Career goal: ${String(careerGoal).trim()}`,
    `- Time available per week: ${weeklyHoursNumber} hours`,
    `- Preferred learning style: ${String(learningStyle).trim()}`,
    "Generate a personalized learning path."
  ].join("\n")

  try{
    const modelToUse = resolvedGeminiModel || GEMINI_MODEL
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: instruction }]
          },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }]
        })
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

    const raw = (data?.candidates?.[0]?.content?.parts || [])
      .map(part => part?.text || "")
      .join("")
      .trim()
    if(!raw){
      return res.status(502).json({ message: "AI service returned an empty response" })
    }

    const parsed = parseJsonFromText(raw)
    const roadmap = normalizeRoadmap(parsed)
    return res.json({ roadmap })
  }catch(_error){
    return res.status(502).json({ message: "Unable to connect to AI service" })
  }
})

app.post("/api/flashcards", authMiddleware, async (req, res) => {
  const { pathId, watchedTitles } = req.body || {}
  if(!pathId || !PATHS_BY_ID[pathId]){
    return res.status(400).json({ message: "Valid pathId is required" })
  }
  const selectedPath = PATHS_BY_ID[pathId]
  const safeWatchedTitles = Array.isArray(watchedTitles)
    ? watchedTitles.map(item => String(item || "").trim()).filter(Boolean).slice(0, 10)
    : []

  if(!process.env.GEMINI_API_KEY){
    return res.json({ cards: fallbackFlashcards(selectedPath, safeWatchedTitles) })
  }

  const prompt = [
    `Generate concise study flashcards for this domain: ${selectedPath.title}.`,
    `Level: ${selectedPath.level}.`,
    `Description: ${selectedPath.description}`,
    safeWatchedTitles.length > 0
      ? `Prioritize these watched topics: ${safeWatchedTitles.join(", ")}`
      : `Available topics: ${selectedPath.videos.map(video => video.title).slice(0, 12).join(", ")}`,
    "Return only valid JSON with this exact schema:",
    "{",
    '  "cards": [',
    '    {"question":"...","hint":"...","answer":"..."}',
    "  ]",
    "}",
    "Rules:",
    "- 6 to 10 cards.",
    "- Question should test understanding.",
    "- Hint must be short and useful.",
    "- Answer should be clear and 1-3 sentences."
  ].join("\n")

  try{
    const modelToUse = resolvedGeminiModel || GEMINI_MODEL
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
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

    const raw = (data?.candidates?.[0]?.content?.parts || [])
      .map(part => part?.text || "")
      .join("")
      .trim()
    const parsed = parseJsonFromText(raw)
    const cards = normalizeFlashcards(parsed)
    return res.json({ cards: cards.length > 0 ? cards : fallbackFlashcards(selectedPath, safeWatchedTitles) })
  }catch(_error){
    return res.json({ cards: fallbackFlashcards(selectedPath, safeWatchedTitles) })
  }
})

app.post("/api/skill-gap-analyzer", authMiddleware, async (req, res) => {
  const { targetRole, resumeText, linkedinSkills, jobDescriptions } = req.body || {}
  const cleanResumeText = String(resumeText || "").trim()
  const cleanJobDescriptions = String(jobDescriptions || "").trim()
  if(!cleanResumeText && !cleanJobDescriptions){
    return res.status(400).json({ message: "Provide resumeText or jobDescriptions" })
  }
  const resolvedTargetRole = inferTargetRole({
    targetRole,
    resumeText: cleanResumeText,
    jobDescriptions: cleanJobDescriptions
  })
  const resolvedJobDescriptions = cleanJobDescriptions || buildRoleBasedJobDescription(resolvedTargetRole)

  const nlp = compareSkillSets({
    resumeText: cleanResumeText,
    linkedinSkills,
    jobDescriptions: resolvedJobDescriptions
  })
  const heuristicPaths = recommendPaths({ targetRole: resolvedTargetRole, missingSkills: nlp.missingSkills })
  const fallback = {
    targetRole: resolvedTargetRole,
    missingSkills: nlp.missingSkills.slice(0, 10).map(formatSkillName),
    existingStrengths: nlp.existingSkills.slice(0, 10).map(formatSkillName),
    recommendedLearningPaths: heuristicPaths,
    analysis: {
      summary: `You want to be a ${resolvedTargetRole}. Build missing skills in a staged manner while reinforcing strengths.`,
      next30Days: "Focus on the top 2 missing skills with weekly project milestones."
    },
    analysisMethod: "nlp"
  }

  if(!process.env.GEMINI_API_KEY){
    return res.json({ result: fallback })
  }

  const systemInstruction = [
    "You are an expert technical recruiter and learning coach.",
    "Analyze skill gaps between candidate profile and job descriptions.",
    "Return only valid JSON with this exact schema:",
    "{",
    '  "targetRole":"...",',
    '  "missingSkills":["..."],',
    '  "existingStrengths":["..."],',
    '  "recommendedLearningPaths":[{"pathId":"frontend|backend|devops|cloud|cybersecurity|aiml","title":"...","reason":"..."}],',
    '  "analysis":{"summary":"...","next30Days":"..."}',
    "}",
    "Rules:",
    "- Prioritize practical tech skills.",
    "- Keep missingSkills concise (max 10).",
    "- Recommend 2 to 4 relevant learning paths.",
    "- Ensure guidance is actionable."
  ].join("\n")

  const userPrompt = [
    `Target role: ${resolvedTargetRole}`,
    `Resume text: ${cleanResumeText || "Not provided"}`,
    `LinkedIn skills: ${extractLinkedInSkills(linkedinSkills).join(", ") || "Not provided"}`,
    `Job descriptions: ${resolvedJobDescriptions}`,
    `NLP extracted job skills: ${nlp.jdSkills.join(", ") || "none"}`,
    `NLP extracted user skills: ${nlp.userSkills.join(", ") || "none"}`,
    `NLP baseline missing skills: ${nlp.missingSkills.join(", ") || "none"}`
  ].join("\n")

  try{
    const modelToUse = resolvedGeminiModel || GEMINI_MODEL
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }]
        })
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

    const raw = (data?.candidates?.[0]?.content?.parts || [])
      .map(part => part?.text || "")
      .join("")
      .trim()
    if(!raw){
      return res.json({ result: fallback })
    }

    const parsed = parseJsonFromText(raw)
    const result = normalizeSkillGapResult(parsed, fallback)
    return res.json({ result })
  }catch(_error){
    return res.json({ result: fallback })
  }
})

app.get("*", (_req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, "index.html"))
})

async function start(){
  await initDatabase()
  app.listen(PORT, () => {
    console.log(`Career Craft server running on http://localhost:${PORT}`)
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
