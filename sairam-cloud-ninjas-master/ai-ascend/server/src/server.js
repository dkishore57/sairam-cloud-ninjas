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
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant"
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata"
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
    email: user.email,
    careerQuizCompleted: Boolean(Number(user.career_quiz_completed || 0))
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

function stripCodeFence(raw){
  if(typeof raw !== "string"){
    return ""
  }
  return raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
}

function sanitizeText(value, fallback){
  const text = typeof value === "string" ? value.trim() : ""
  return text || fallback
}

function sanitizeList(value, fallback = []){
  if(!Array.isArray(value)){
    return fallback
  }
  const normalized = value
    .map(item => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
  return normalized.length > 0 ? normalized : fallback
}

function buildMentorFallbackAnswer(question, pathId = ""){
  const prompt = sanitizeText(question, "Explain this concept in simple terms.")
  const lower = prompt.toLowerCase()
  const selectedPath = PATHS_BY_ID[sanitizeText(pathId, "").toLowerCase()]

  let focus = "Core concept clarity"
  let explanation = "Break the topic into fundamentals, purpose, and one practical application."
  let steps = [
    "Define the concept in one sentence.",
    "Identify where it is used in real projects.",
    "Practice with a small, focused hands-on task."
  ]
  let quickQuiz = "In one line, explain when you would use this concept."

  if(lower.includes("docker")){
    focus = "Docker"
    explanation = "Docker packages your app and its dependencies into a container so it runs the same on any machine."
    steps = [
      "Learn images vs containers and basic lifecycle commands.",
      "Create a simple Dockerfile for one sample app.",
      "Run and debug the container locally with exposed ports."
    ]
    quickQuiz = "What is the practical difference between a Docker image and a container?"
  }else if(lower.includes("api")){
    focus = "APIs"
    explanation = "An API is a contract that lets software systems communicate using defined requests and responses."
    steps = [
      "Understand endpoint, method, request body, and response status.",
      "Build one CRUD endpoint and validate inputs.",
      "Test with Postman/curl and document error cases."
    ]
    quickQuiz = "Why are HTTP status codes important in API design?"
  }else if(lower.includes("react") || lower.includes("frontend")){
    focus = "Frontend foundations"
    explanation = "Frontend development builds user interfaces and manages user interactions, state, and data rendering."
    steps = [
      "Understand components, props, and state.",
      "Build one reusable component and pass dynamic data.",
      "Fetch API data and render loading/error states."
    ]
    quickQuiz = "When should you keep data in local component state vs shared state?"
  }else if(lower.includes("sql") || lower.includes("database")){
    focus = "Databases and SQL"
    explanation = "SQL is used to store, query, and update structured data reliably and efficiently."
    steps = [
      "Review SELECT, WHERE, JOIN, and GROUP BY basics.",
      "Model one table relation using primary and foreign keys.",
      "Write one optimized query and verify with indexes."
    ]
    quickQuiz = "Why do joins matter when designing backend features?"
  }else if(lower.includes("linux") || lower.includes("bash")){
    focus = "Linux and Bash"
    explanation = "Linux is the OS environment; Bash is the command shell used to interact with it."
    steps = [
      "Practice navigation and file commands.",
      "Write one small Bash script with variables and conditions.",
      "Automate one repeated local task."
    ]
    quickQuiz = "Give one scenario where a Bash script saves development time."
  }

  return [
    `Mentor fallback mode (Gemini temporarily unavailable).`,
    ``,
    `Topic: ${focus}`,
    selectedPath ? `Current path: ${selectedPath.title}` : "",
    `Question: ${prompt}`,
    ``,
    `Simple explanation:`,
    explanation,
    ``,
    `What to do next:`,
    `1. ${steps[0]}`,
    `2. ${steps[1]}`,
    `3. ${steps[2]}`,
    ``,
    `Quick check: ${quickQuiz}`
  ].filter(Boolean).join("\n")
}

function buildMentorSystemPrompt(pathId){
  const basePrompt = "You are a concise AI learning mentor. Give practical, accurate, beginner-friendly guidance with clear next steps."
  const selectedPath = PATHS_BY_ID[sanitizeText(pathId, "").toLowerCase()]
  if(!selectedPath){
    return `${basePrompt} If path context is missing, ask one clarifying question before giving advanced guidance.`
  }

  const pathTitle = selectedPath.title
  const role = selectedPath.role
  const tags = Array.isArray(selectedPath.tags) ? selectedPath.tags.join(", ") : ""
  return [
    basePrompt,
    `Current learner path: ${pathTitle} (${role}).`,
    `Path scope tags: ${tags}.`,
    `Keep answers strictly aligned to this path.`,
    `If user asks unrelated topics, briefly answer then steer back to ${pathTitle} roadmap.`,
    "Prefer examples, tools, and interview prep relevant to this path."
  ].join(" ")
}

async function persistAndReturnChat(res, userId, question, answer, extras = {}){
  await dbQuery(
    "INSERT INTO chat_messages (user_id, role, text) VALUES (?, ?, ?), (?, ?, ?)",
    [userId, "user", question, userId, "assistant", answer]
  )

  const historyRows = await dbQuery(
    "SELECT role, text, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
    [userId]
  )
  const history = historyRows.reverse().map(row => ({
    role: row.role,
    text: row.text,
    createdAt: row.created_at
  }))

  return res.json({ answer, history, ...extras })
}

function isQuotaLikeError(status, message){
  const text = sanitizeText(message, "").toLowerCase()
  return status === 429 || /quota|insufficient_quota|rate limit|resource exhausted|too many requests/.test(text)
}

async function generateChatWithGroq(priorHistory, question, systemPrompt){
  if(!process.env.GROQ_API_KEY){
    return { ok: false, provider: "groq", reason: "missing_key", message: "Missing GROQ_API_KEY" }
  }

  const messages = [
    {
      role: "system",
      content: sanitizeText(systemPrompt, "You are a concise AI learning mentor. Give practical, accurate, beginner-friendly guidance with clear next steps.")
    },
    ...priorHistory.map(item => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.text
    })),
    { role: "user", content: question }
  ]

  try{
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.4,
        messages
      })
    })

    const data = await response.json().catch(() => ({}))
    if(!response.ok){
      const upstreamMessage = data?.error?.message || "Groq request failed"
      return {
        ok: false,
        provider: "groq",
        reason: isQuotaLikeError(response.status, upstreamMessage) ? "quota_exceeded" : "upstream_error",
        status: response.status,
        message: upstreamMessage
      }
    }

    const answer = sanitizeText(data?.choices?.[0]?.message?.content, "")
    if(!answer){
      return {
        ok: false,
        provider: "groq",
        reason: "empty_response",
        message: "Groq returned an empty response"
      }
    }
    return { ok: true, provider: "groq", answer }
  }catch(error){
    return {
      ok: false,
      provider: "groq",
      reason: "network_error",
      message: error?.message || "Groq network error"
    }
  }
}

async function generateChatWithOpenAI(priorHistory, question, systemPrompt){
  if(!process.env.OPENAI_API_KEY){
    return { ok: false, provider: "openai", reason: "missing_key", message: "Missing OPENAI_API_KEY" }
  }

  const messages = [
    {
      role: "system",
      content: sanitizeText(systemPrompt, "You are a concise AI learning mentor. Give practical, accurate, beginner-friendly guidance with clear next steps.")
    },
    ...priorHistory.map(item => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.text
    })),
    { role: "user", content: question }
  ]

  try{
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        messages
      })
    })

    const data = await response.json().catch(() => ({}))
    if(!response.ok){
      const upstreamMessage = data?.error?.message || "OpenAI request failed"
      const quotaHit = response.status === 429 || /quota|insufficient_quota|rate limit/i.test(upstreamMessage)
      return {
        ok: false,
        provider: "openai",
        reason: quotaHit ? "quota_exceeded" : "upstream_error",
        status: response.status,
        message: upstreamMessage
      }
    }

    const answer = sanitizeText(data?.choices?.[0]?.message?.content, "")
    if(!answer){
      return {
        ok: false,
        provider: "openai",
        reason: "empty_response",
        message: "OpenAI returned an empty response"
      }
    }

    return { ok: true, provider: "openai", answer }
  }catch(error){
    return {
      ok: false,
      provider: "openai",
      reason: "network_error",
      message: error?.message || "OpenAI network error"
    }
  }
}

async function generateChatWithGemini(priorHistory, question, systemPrompt){
  if(!process.env.GEMINI_API_KEY){
    return { ok: false, provider: "gemini", reason: "missing_key", message: "Missing GEMINI_API_KEY" }
  }

  const contents = [
    { role: "user", text: `System instruction: ${sanitizeText(systemPrompt, "You are a concise AI learning mentor.")}` },
    ...priorHistory,
    { role: "user", text: question }
  ]
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
      const upstreamMessage = data?.error?.message || "Gemini request failed"
      const isQuotaError = response.status === 429 || /quota exceeded/i.test(upstreamMessage)
      return {
        ok: false,
        provider: "gemini",
        reason: isQuotaError ? "quota_exceeded" : "upstream_error",
        status: response.status,
        message: upstreamMessage,
        retryAfterSec: isQuotaError ? extractRetryAfterSec(upstreamMessage) : null
      }
    }

    const answer = (data?.candidates?.[0]?.content?.parts || [])
      .map(part => part?.text || "")
      .join("")
      .trim()

    if(!answer){
      const blockReason = data?.promptFeedback?.blockReason
      return {
        ok: false,
        provider: "gemini",
        reason: blockReason ? "safety_block" : "empty_response",
        message: blockReason
          ? `Gemini blocked by safety filter: ${blockReason}`
          : "Gemini returned an empty response"
      }
    }

    return { ok: true, provider: "gemini", answer }
  }catch(error){
    return {
      ok: false,
      provider: "gemini",
      reason: "network_error",
      message: error?.message || "Gemini network error"
    }
  }
}

async function generateMentorChat(priorHistory, question, systemPrompt){
  const attempted = []

  const groqResult = await generateChatWithGroq(priorHistory, question, systemPrompt)
  attempted.push(groqResult)
  if(groqResult.ok){
    return { ok: true, provider: "groq", answer: groqResult.answer, attempted }
  }

  const openaiResult = await generateChatWithOpenAI(priorHistory, question, systemPrompt)
  attempted.push(openaiResult)
  if(openaiResult.ok){
    return { ok: true, provider: "openai", answer: openaiResult.answer, attempted }
  }

  const geminiResult = await generateChatWithGemini(priorHistory, question, systemPrompt)
  attempted.push(geminiResult)
  if(geminiResult.ok){
    return { ok: true, provider: "gemini", answer: geminiResult.answer, attempted }
  }

  return { ok: false, attempted }
}

async function generateStructuredJsonWithGroq(prompt){
  if(!process.env.GROQ_API_KEY){
    return { ok: false, provider: "groq", reason: "missing_key", message: "Missing GROQ_API_KEY" }
  }
  try{
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "Return valid JSON only. No markdown fences. No prose outside JSON."
          },
          { role: "user", content: prompt }
        ]
      })
    })
    const data = await response.json().catch(() => ({}))
    if(!response.ok){
      const upstreamMessage = data?.error?.message || "Groq request failed"
      return {
        ok: false,
        provider: "groq",
        reason: isQuotaLikeError(response.status, upstreamMessage) ? "quota_exceeded" : "upstream_error",
        status: response.status,
        message: upstreamMessage
      }
    }
    const text = sanitizeText(data?.choices?.[0]?.message?.content, "")
    if(!text){
      return { ok: false, provider: "groq", reason: "empty_response", message: "Groq returned an empty response" }
    }
    return { ok: true, provider: "groq", text }
  }catch(error){
    return {
      ok: false,
      provider: "groq",
      reason: "network_error",
      message: error?.message || "Groq network error"
    }
  }
}

async function generateStructuredJsonWithGemini(prompt){
  if(!process.env.GEMINI_API_KEY){
    return { ok: false, provider: "gemini", reason: "missing_key", message: "Missing GEMINI_API_KEY" }
  }
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
      const upstreamMessage = data?.error?.message || "Gemini request failed"
      return {
        ok: false,
        provider: "gemini",
        reason: isQuotaLikeError(response.status, upstreamMessage) ? "quota_exceeded" : "upstream_error",
        status: response.status,
        message: upstreamMessage
      }
    }
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map(part => part?.text || "")
      .join("")
      .trim()
    if(!text){
      return { ok: false, provider: "gemini", reason: "empty_response", message: "Gemini returned an empty response" }
    }
    return { ok: true, provider: "gemini", text }
  }catch(error){
    return {
      ok: false,
      provider: "gemini",
      reason: "network_error",
      message: error?.message || "Gemini network error"
    }
  }
}

async function generateStructuredJson(prompt){
  const attempts = []

  const groqResult = await generateStructuredJsonWithGroq(prompt)
  attempts.push(groqResult)
  if(groqResult.ok){
    return { ok: true, provider: "groq", text: groqResult.text, attempts }
  }

  const geminiResult = await generateStructuredJsonWithGemini(prompt)
  attempts.push(geminiResult)
  if(geminiResult.ok){
    return { ok: true, provider: "gemini", text: geminiResult.text, attempts }
  }

  return { ok: false, attempts }
}

function fallbackRoadmap({ careerGoal, currentLevel, hoursPerWeek, learningStyle }){
  const safeGoal = sanitizeText(careerGoal, "Tech Career")
  const weeks = Math.max(8, Math.min(24, Math.ceil(160 / Math.max(1, hoursPerWeek))))
  const weekLabels = [1, 2, 3, 4]
  const phases = [
    {
      week: weekLabels[0],
      title: `Foundations for ${safeGoal}`,
      goals: [
        `Set up a weekly ${hoursPerWeek}-hour study plan`,
        "Complete core fundamentals and terminology",
        "Build concise revision notes after each session"
      ],
      resources: [
        "Official documentation for the main technology stack",
        "Beginner-friendly YouTube or MOOC course",
        "Hands-on exercises from coding practice platforms"
      ],
      deliverable: "Publish a notes repo with weekly checkpoints"
    },
    {
      week: weekLabels[1],
      title: "Core Skills and Practice",
      goals: [
        `Follow a ${currentLevel} to intermediate progression track`,
        "Solve small practical tasks every week",
        `Use ${learningStyle} style sessions (videos, docs, or projects) consistently`
      ],
      resources: [
        "Curated tutorials from Careercraft path library",
        "Focused coding/problem-solving exercises",
        "Community Q&A and mentor support"
      ],
      deliverable: "Build 2 mini-projects showing core concepts"
    },
    {
      week: weekLabels[2],
      title: "Project and Portfolio Building",
      goals: [
        "Apply concepts in one end-to-end practical project",
        "Write clear README and architecture notes",
        "Track blockers and resolve them with mentor prompts"
      ],
      resources: [
        "Open-source example repositories",
        "Deployment or hosting tutorials",
        "Code review checklist"
      ],
      deliverable: "Ship one portfolio-ready project"
    },
    {
      week: weekLabels[3],
      title: "Interview and Job Preparation",
      goals: [
        "Revise fundamentals and common interview topics",
        "Practice scenario-based questions and tradeoff reasoning",
        "Prepare role-focused resume bullet points"
      ],
      resources: [
        "Interview prep guides and mock question banks",
        "Job descriptions mapped to required skills",
        "Resume and LinkedIn optimization checklist"
      ],
      deliverable: "Create an interview prep tracker and job-application plan"
    }
  ]

  return {
    title: `${safeGoal} Personalized Plan`,
    summary: `A ${weeks}-week plan tailored for a ${currentLevel} learner with ${hoursPerWeek} hours/week using ${learningStyle} learning style.`,
    timelineWeeks: weeks,
    phases
  }
}

function normalizeRoadmap(payload, fallbackInput){
  if(!payload || typeof payload !== "object"){
    return fallbackRoadmap(fallbackInput)
  }

  const fallback = fallbackRoadmap(fallbackInput)
  const phasesRaw = Array.isArray(payload.phases) ? payload.phases : []
  const phases = phasesRaw
    .map((phase, index) => ({
      week: Number(phase?.week) || index + 1,
      title: sanitizeText(phase?.title, `Phase ${index + 1}`),
      goals: sanitizeList(phase?.goals, ["Complete the defined learning outcomes"]),
      resources: sanitizeList(phase?.resources, ["Use trusted tutorials and official docs"]),
      deliverable: sanitizeText(phase?.deliverable, "Submit a weekly progress update")
    }))
    .slice(0, 10)

  return {
    title: sanitizeText(payload.title, fallback.title),
    summary: sanitizeText(payload.summary, fallback.summary),
    timelineWeeks: Math.max(1, Number(payload.timelineWeeks) || fallback.timelineWeeks),
    phases: phases.length > 0 ? phases : fallback.phases
  }
}

async function generateLearningRoadmap(input){
  const fallback = fallbackRoadmap(input)
  if(!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY){
    return { roadmap: fallback, source: "fallback" }
  }

  const prompt = [
    "Generate a personalized learning roadmap as strict JSON only.",
    "Return an object with keys: title, summary, timelineWeeks, phases.",
    "phases must be an array of objects with keys: week, title, goals, resources, deliverable.",
    "goals and resources must each have 2 to 5 concise string items.",
    "No markdown, no explanations, no extra keys.",
    "",
    `careerGoal: ${input.careerGoal}`,
    `currentLevel: ${input.currentLevel}`,
    `hoursPerWeek: ${input.hoursPerWeek}`,
    `learningStyle: ${input.learningStyle}`
  ].join("\n")

  try{
    const result = await generateStructuredJson(prompt)
    if(!result.ok){
      return { roadmap: fallback, source: "fallback" }
    }
    const parsed = JSON.parse(stripCodeFence(result.text))
    return { roadmap: normalizeRoadmap(parsed, input), source: result.provider }
  }catch(_error){
    return { roadmap: fallback, source: "fallback" }
  }
}

function tokenizeSkills(text){
  if(typeof text !== "string"){
    return []
  }
  return text
    .split(/[,\n|/]/g)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
}

function dedupeStrings(items){
  const seen = new Set()
  const result = []
  for(const item of items){
    const normalized = sanitizeText(item, "").toLowerCase()
    if(!normalized || seen.has(normalized)){
      continue
    }
    seen.add(normalized)
    result.push(item.trim())
  }
  return result
}

function recommendPathsFromMissingSkills(targetRole, missingSkills){
  const roleText = `${targetRole}`.toLowerCase()
  const skillTokens = missingSkills.map(item => item.toLowerCase())

  const scored = PATHS.map(path => {
    const bag = `${path.title} ${path.description} ${path.role} ${(path.tags || []).join(" ")}`.toLowerCase()
    let score = 0
    if(roleText && (bag.includes(roleText) || roleText.includes(path.id))){
      score += 2
    }
    for(const skill of skillTokens){
      if(skill && bag.includes(skill)){
        score += 1
      }
    }
    return {
      id: path.id,
      title: path.title,
      score
    }
  })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const recommended = scored.map(item => ({
    id: item.id,
    title: item.title,
    reason: "Matches your role target and missing skill areas"
  }))

  if(recommended.length > 0){
    return recommended
  }

  // Ensure users always see practical next options, even with sparse/ambiguous input.
  const roleFallbackMap = [
    { match: ["data", "ml", "ai"], ids: ["backend", "cloud"] },
    { match: ["backend", "api", "server"], ids: ["backend", "devops"] },
    { match: ["frontend", "ui", "web"], ids: ["frontend", "backend"] },
    { match: ["devops", "sre", "platform"], ids: ["devops", "cloud"] },
    { match: ["cloud", "aws", "gcp", "azure"], ids: ["cloud", "devops"] }
  ]
  const mapped = roleFallbackMap.find(item => item.match.some(token => roleText.includes(token)))
  const ids = mapped?.ids || ["backend", "cloud"]
  return ids
    .map(id => PATHS_BY_ID[id])
    .filter(Boolean)
    .map(path => ({
      id: path.id,
      title: path.title,
      reason: "Recommended as a strong baseline for your target role"
    }))
}

function fallbackSkillGap(input){
  const resumeTokens = tokenizeSkills(`${input.resumeText}\n${input.jobDescription}`)
  const provided = tokenizeSkills(input.providedSkillsText)
  const all = dedupeStrings([...provided, ...resumeTokens])

  const baselineByRole = {
    backend: ["Node.js", "API Security", "System Design", "Redis", "Docker", "SQL"],
    frontend: ["JavaScript", "React", "CSS", "Accessibility", "Testing"],
    devops: ["Linux", "Docker", "Kubernetes", "CI/CD", "Terraform", "AWS"],
    cloud: ["AWS", "Networking", "Security", "Monitoring", "Infrastructure as Code"],
    data: ["Python", "SQL", "Statistics", "Pandas", "Machine Learning"]
  }

  const role = input.targetRole.toLowerCase()
  let baseline = ["Problem Solving", "Git", "Testing", "System Design", "Communication"]
  for(const key of Object.keys(baselineByRole)){
    if(role.includes(key)){
      baseline = baselineByRole[key]
      break
    }
  }

  const known = all.map(item => item.toLowerCase())
  const strengths = dedupeStrings(
    baseline.filter(skill => known.some(token => token.includes(skill.toLowerCase())))
  ).slice(0, 6)
  const missingSkills = dedupeStrings(
    baseline.filter(skill => !known.some(token => token.includes(skill.toLowerCase())))
  ).slice(0, 8)
  const recommendations = missingSkills.slice(0, 5).map(skill => `Practice ${skill} with one mini project`)
  const recommendedPaths = recommendPathsFromMissingSkills(input.targetRole, missingSkills)

  return {
    summary: `You are targeting ${input.targetRole}. Focus on closing the top missing skills to improve interview readiness.`,
    strengths: strengths.length > 0 ? strengths : ["Basic foundational knowledge"],
    missingSkills: missingSkills.length > 0 ? missingSkills : ["Role-specific advanced topics"],
    recommendations: recommendations.length > 0 ? recommendations : ["Follow a structured weekly study plan"],
    recommendedPaths
  }
}

function normalizeRecommendedPaths(value, fallback){
  if(!Array.isArray(value)){
    return fallback
  }

  function matchPathId(rawId, rawTitle){
    const id = sanitizeText(rawId, "").toLowerCase()
    if(id && PATHS_BY_ID[id]){
      return id
    }
    const titleText = sanitizeText(rawTitle, "").toLowerCase()
    if(!titleText){
      return ""
    }
    const matched = PATHS.find(path => {
      const bag = `${path.id} ${path.title} ${path.role} ${(path.tags || []).join(" ")}`.toLowerCase()
      return bag.includes(titleText) || titleText.includes(path.id) || titleText.includes(path.title.toLowerCase())
    })
    return matched?.id || ""
  }

  const normalized = value
    .map(item => {
      const inferredId = matchPathId(item?.id || item?.pathId, item?.title || item?.pathTitle)
      const inferredTitle = inferredId ? PATHS_BY_ID[inferredId].title : ""
      return {
      id: inferredId,
      title: sanitizeText(item?.title || item?.pathTitle, inferredTitle || ""),
      reason: sanitizeText(item?.reason, "Recommended based on your missing skills")
      }
    })
    .filter(item => item.id)
  return normalized.length > 0 ? normalized.slice(0, 5) : fallback
}

function normalizeSkillGap(payload, input){
  const fallback = fallbackSkillGap(input)
  if(!payload || typeof payload !== "object"){
    return fallback
  }

  return {
    summary: sanitizeText(payload.summary, fallback.summary),
    strengths: sanitizeList(payload.strengths, fallback.strengths).slice(0, 10),
    missingSkills: sanitizeList(payload.missingSkills, fallback.missingSkills).slice(0, 12),
    recommendations: sanitizeList(payload.recommendations, fallback.recommendations).slice(0, 12),
    recommendedPaths: normalizeRecommendedPaths(payload.recommendedPaths, fallback.recommendedPaths)
  }
}

async function generateSkillGapAnalysis(input){
  const fallback = fallbackSkillGap(input)
  if(!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY){
    return { analysis: fallback, source: "fallback" }
  }

  const prompt = [
    "Analyze skill gaps for the target role and return strict JSON only.",
    "Return keys: summary, strengths, missingSkills, recommendations, recommendedPaths.",
    "strengths/missingSkills/recommendations must be arrays of concise strings.",
    "recommendedPaths must be array of objects with keys id, title, reason.",
    "Use only ids from: devops, frontend, backend, cloud.",
    "No markdown and no extra keys.",
    "",
    `targetRole: ${input.targetRole}`,
    `providedSkills: ${input.providedSkillsText}`,
    `resumeText: ${input.resumeText}`,
    `jobDescription: ${input.jobDescription}`
  ].join("\n")

  try{
    const result = await generateStructuredJson(prompt)
    if(!result.ok){
      return { analysis: fallback, source: "fallback" }
    }
    const parsed = JSON.parse(stripCodeFence(result.text))
    return { analysis: normalizeSkillGap(parsed, input), source: result.provider }
  }catch(_error){
    return { analysis: fallback, source: "fallback" }
  }
}

function clampScore(value, min, max){
  return Math.max(min, Math.min(max, value))
}

function computeAtsScore(input, missingSkills = []){
  const resumeTokens = tokenizeSkills(`${input.resumeText}\n${input.providedSkillsText}`)
  const jdTokens = tokenizeSkills(input.jobDescription)
  const roleTokens = tokenizeSkills(input.targetRole)
  const resumeSet = new Set(resumeTokens.map(item => item.toLowerCase()))
  const jdSet = new Set(jdTokens.map(item => item.toLowerCase()))

  const overlapCount = [...jdSet].filter(token => resumeSet.has(token)).length
  const jdCoverage = jdSet.size > 0 ? overlapCount / jdSet.size : 0.45
  const missingPenalty = Math.min(0.4, (missingSkills.length || 0) * 0.04)
  const roleBoost = roleTokens.some(token => resumeSet.has(token)) ? 0.08 : 0

  const score = Math.round(clampScore((jdCoverage * 100) + (roleBoost * 100) - (missingPenalty * 100), 20, 96))
  return score
}

function fallbackResumeReview(input, skillGapAnalysis){
  const missing = Array.isArray(skillGapAnalysis?.missingSkills) ? skillGapAnalysis.missingSkills : []
  const strengths = Array.isArray(skillGapAnalysis?.strengths)
    ? skillGapAnalysis.strengths.slice(0, 5)
    : ["Role-relevant technical foundation"]
  const recommendations = Array.isArray(skillGapAnalysis?.recommendations)
    ? skillGapAnalysis.recommendations
    : []
  const atsScore = computeAtsScore(input, missing)
  const keywordGaps = missing.slice(0, 8)
  const changes = [
    "Rewrite experience bullets with metrics (impact, scale, or performance gains).",
    "Align resume headline and summary with the target role keywords.",
    "Prioritize most relevant projects near the top and mention tech stack clearly.",
    "Add role-specific skills section matching job description phrasing."
  ]
  const rewrittenBullets = [
    `Built and optimized features for ${input.targetRole}, improving delivery quality and reducing defects.`,
    "Implemented measurable improvements with clear before/after impact metrics.",
    "Collaborated cross-functionally to deliver production-ready solutions aligned to business goals."
  ]

  return {
    atsScore,
    summary: `Resume fit for ${input.targetRole} is moderate. Improve keyword alignment and quantified impact to increase interview shortlisting chances.`,
    strengths,
    changesNeeded: dedupeStrings([...changes, ...recommendations]).slice(0, 10),
    keywordGaps: keywordGaps.length > 0 ? keywordGaps : ["Role-specific skill keywords from JD"],
    rewrittenBullets
  }
}

function normalizeResumeReview(payload, input, skillGapAnalysis){
  const fallback = fallbackResumeReview(input, skillGapAnalysis)
  if(!payload || typeof payload !== "object"){
    return fallback
  }
  const atsScore = clampScore(Number(payload.atsScore) || fallback.atsScore, 20, 99)
  return {
    atsScore,
    summary: sanitizeText(payload.summary, fallback.summary),
    strengths: sanitizeList(payload.strengths, fallback.strengths).slice(0, 10),
    changesNeeded: sanitizeList(payload.changesNeeded, fallback.changesNeeded).slice(0, 14),
    keywordGaps: sanitizeList(payload.keywordGaps, fallback.keywordGaps).slice(0, 14),
    rewrittenBullets: sanitizeList(payload.rewrittenBullets, fallback.rewrittenBullets).slice(0, 8)
  }
}

async function generateResumeReview(input, skillGapAnalysis){
  const fallback = fallbackResumeReview(input, skillGapAnalysis)
  if(!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY){
    return { review: fallback, source: "fallback" }
  }

  const prompt = [
    "Act as an ATS + hiring resume review agent.",
    "Return strict JSON with keys: atsScore, summary, strengths, changesNeeded, keywordGaps, rewrittenBullets.",
    "atsScore must be integer between 0 and 100 for the given role and JD fit.",
    "All list keys must be arrays of concise actionable strings.",
    "rewrittenBullets should be high-impact resume bullet examples with metrics style wording.",
    "No markdown and no extra keys.",
    "",
    `targetRole: ${input.targetRole}`,
    `jobDescription: ${input.jobDescription}`,
    `resumeText: ${input.resumeText}`,
    `providedSkills: ${input.providedSkillsText}`,
    `knownMissingSkills: ${(skillGapAnalysis?.missingSkills || []).join(", ")}`
  ].join("\n")

  try{
    const result = await generateStructuredJson(prompt)
    if(!result.ok){
      return { review: fallback, source: "fallback" }
    }
    const parsed = JSON.parse(stripCodeFence(result.text))
    return { review: normalizeResumeReview(parsed, input, skillGapAnalysis), source: result.provider }
  }catch(_error){
    return { review: fallback, source: "fallback" }
  }
}

function valueToScore(value){
  const normalized = sanitizeText(value, "").toLowerCase()
  if(normalized === "yes"){
    return 2
  }
  if(normalized === "sometimes"){
    return 1
  }
  return 0
}

function buildCareerMatches(scoreMap){
  return Object.entries(scoreMap)
    .sort(([, a], [, b]) => b - a)
    .map(([role, score], index) => ({ role, score, rank: index + 1 }))
    .slice(0, 3)
}

function mapRoleToPath(role){
  const normalized = role.toLowerCase()
  if(normalized.includes("frontend")){
    return "frontend"
  }
  if(normalized.includes("backend")){
    return "backend"
  }
  if(normalized.includes("devops")){
    return "devops"
  }
  if(normalized.includes("cloud") || normalized.includes("ml") || normalized.includes("data")){
    return "cloud"
  }
  return "backend"
}

function fallbackCareerRecommendation(answers){
  const logic = valueToScore(answers.logicPreference)
  const ui = valueToScore(answers.uiPreference)
  const math = valueToScore(answers.mathPreference)
  const infra = valueToScore(answers.infraPreference)
  const collab = valueToScore(answers.collaborationPreference)

  const scoreMap = {
    "Backend Developer": logic * 2 + infra + collab,
    "Frontend Developer": ui * 2 + collab + logic,
    "DevOps Engineer": infra * 2 + logic + collab,
    "Cloud Engineer": infra * 2 + logic + math,
    "Data Scientist": math * 2 + logic,
    "ML Engineer": math * 2 + logic + infra
  }

  const top = buildCareerMatches(scoreMap).map(item => {
    const pathId = mapRoleToPath(item.role)
    return {
      role: item.role,
      score: item.score,
      reason: `Strong alignment with your quiz answers (rank #${item.rank}).`,
      pathId
    }
  })

  const recommendedPaths = dedupeStrings(top.map(item => item.pathId))
    .slice(0, 3)
    .map(id => ({
      id,
      title: PATHS_BY_ID[id]?.title || id,
      reason: "Mapped from your top career matches"
    }))

  return {
    summary: "Career matches generated from your quiz preferences. Use the top match to pick a focused learning path.",
    matches: top,
    recommendedPaths
  }
}

function normalizeCareerMatches(value, fallback){
  if(!Array.isArray(value)){
    return fallback
  }
  const normalized = value
    .map(item => {
      const role = sanitizeText(item?.role, "")
      if(!role){
        return null
      }
      const pathId = mapRoleToPath(sanitizeText(item?.pathId, role))
      return {
        role,
        score: Math.max(0, Number(item?.score) || 0),
        reason: sanitizeText(item?.reason, "Suggested from your preferences"),
        pathId
      }
    })
    .filter(Boolean)
  return normalized.length > 0 ? normalized.slice(0, 3) : fallback
}

function normalizeCareerRecommendation(payload, answers){
  const fallback = fallbackCareerRecommendation(answers)
  if(!payload || typeof payload !== "object"){
    return fallback
  }
  const matches = normalizeCareerMatches(payload.matches, fallback.matches)
  const recommendedPaths = normalizeRecommendedPaths(
    payload.recommendedPaths,
    fallback.recommendedPaths
  )

  return {
    summary: sanitizeText(payload.summary, fallback.summary),
    matches,
    recommendedPaths
  }
}

async function generateCareerRecommendation(answers){
  const fallback = fallbackCareerRecommendation(answers)
  if(!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY){
    return { recommendation: fallback, source: "fallback" }
  }

  const prompt = [
    "You are a career recommender for a learning platform.",
    "Return strict JSON only with keys: summary, matches, recommendedPaths.",
    "matches must be array of max 3 objects: role, score, reason, pathId.",
    "allowed pathId values: devops, frontend, backend, cloud.",
    "recommendedPaths must be array of objects: id, title, reason.",
    "No markdown, no extra keys.",
    "",
    `logicPreference: ${answers.logicPreference}`,
    `uiPreference: ${answers.uiPreference}`,
    `mathPreference: ${answers.mathPreference}`,
    `infraPreference: ${answers.infraPreference}`,
    `collaborationPreference: ${answers.collaborationPreference}`
  ].join("\n")

  try{
    const result = await generateStructuredJson(prompt)
    if(!result.ok){
      return { recommendation: fallback, source: "fallback" }
    }
    const parsed = JSON.parse(stripCodeFence(result.text))
    return { recommendation: normalizeCareerRecommendation(parsed, answers), source: result.provider }
  }catch(_error){
    return { recommendation: fallback, source: "fallback" }
  }
}

function normalizeFlashcard(card, index){
  return {
    prompt: sanitizeText(card?.prompt || card?.question, `Flashcard ${index + 1}`),
    answer: sanitizeText(card?.answer, "Answer not provided"),
    hint: sanitizeText(card?.hint || card?.explanation, "Review key definitions and examples.")
  }
}

function extractTopicKeywords(input){
  const stop = new Set(["what", "with", "from", "into", "about", "this", "that", "your", "course"])
  const bucket = [
    ...(Array.isArray(input?.videoTags) ? input.videoTags : []),
    ...(Array.isArray(input?.pathTags) ? input.pathTags : []),
    sanitizeText(input?.videoSubdomain, ""),
    sanitizeText(input?.videoTitle, "")
  ]
  const words = bucket
    .join(" ")
    .toLowerCase()
    .match(/[a-z][a-z0-9-]{2,}/g) || []

  const seen = new Set()
  const unique = []
  for(const word of words){
    if(stop.has(word) || seen.has(word)){
      continue
    }
    seen.add(word)
    unique.push(word)
    if(unique.length >= 8){
      break
    }
  }
  return unique
}

function fallbackVideoQuiz(input){
  const topic = sanitizeText(input.videoTitle, "current topic")
  const domain = sanitizeText(input.pathTitle, "learning path")
  const keywords = extractTopicKeywords(input)
  const focusA = keywords[0] || "core concepts"
  const focusB = keywords[1] || "practical workflow"
  const focusC = keywords[2] || "best practices"
  const flashcards = [
    {
      prompt: `What is ${topic} and why is it used in ${domain}?`,
      answer: `${topic} helps teams build, deliver, and maintain software with better consistency and quality.`,
      hint: "Think purpose + business value."
    },
    {
      prompt: `How does ${focusA} connect with ${topic}?`,
      answer: `${focusA} is a foundational part of ${topic} and affects implementation choices in real projects.`,
      hint: "Relate concept to practical execution."
    },
    {
      prompt: `Explain ${focusB} in the context of ${topic}.`,
      answer: `${focusB} defines how tasks move from planning to execution with predictable outcomes.`,
      hint: "Describe process flow in simple steps."
    },
    {
      prompt: `What is one common beginner mistake in ${topic}?`,
      answer: "Skipping fundamentals and applying tools without understanding underlying workflow.",
      hint: "Think of mistakes that reduce reliability."
    },
    {
      prompt: `Give one real-world use case of ${topic}.`,
      answer: "Teams apply it to automate repeated tasks, improve quality checks, and speed up delivery.",
      hint: "Use deployment/testing or collaboration examples."
    },
    {
      prompt: `Why does ${focusC} matter when learning ${topic}?`,
      answer: `${focusC} improves maintainability, reduces failures, and helps teams scale implementation.`,
      hint: "Answer in terms of long-term project impact."
    },
    {
      prompt: `How would you explain ${topic} to a beginner in 2 lines?`,
      answer: `${topic} is a structured approach to build and run software systems effectively. It combines process, tools, and team practices.`,
      hint: "Keep it simple and practical."
    },
    {
      prompt: `What should you learn next after ${topic}?`,
      answer: "Move to adjacent tools and apply them in a mini project with measurable outcomes.",
      hint: "Think progression and project-based learning."
    }
  ]

  return {
    title: `${topic} Flashcards`,
    summary: `Subject-focused flashcards for ${domain}.`,
    flashcards,
    quizItems: buildQuizFromFlashcards(flashcards)
  }
}

function extractYouTubeVideoId(url){
  const raw = sanitizeText(url, "")
  if(!raw){
    return ""
  }

  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/
  ]
  for(const pattern of patterns){
    const match = raw.match(pattern)
    if(match?.[1]){
      return match[1]
    }
  }
  return ""
}

function decodeHtmlEntities(text){
  return `${text || ""}`
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
}

function transcriptFromJson3(data){
  const events = Array.isArray(data?.events) ? data.events : []
  const parts = []
  for(const event of events){
    const segs = Array.isArray(event?.segs) ? event.segs : []
    for(const seg of segs){
      const text = sanitizeText(seg?.utf8, "")
      if(text){
        parts.push(text)
      }
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim()
}

function transcriptFromXml(xml){
  const matches = `${xml || ""}`.match(/<text[^>]*>([\s\S]*?)<\/text>/g) || []
  const parts = matches
    .map(block => {
      const inner = block.replace(/<text[^>]*>/, "").replace(/<\/text>/, "")
      return decodeHtmlEntities(inner).trim()
    })
    .filter(Boolean)
  return parts.join(" ").replace(/\s+/g, " ").trim()
}

async function fetchYouTubeTranscript(videoUrl){
  const videoId = extractYouTubeVideoId(videoUrl)
  if(!videoId){
    return ""
  }

  const base = "https://www.youtube.com/api/timedtext"
  const attempts = [
    `${base}?v=${videoId}&lang=en&fmt=json3`,
    `${base}?v=${videoId}&lang=en`,
    `${base}?v=${videoId}&lang=a.en&fmt=json3`,
    `${base}?v=${videoId}&lang=a.en`
  ]

  for(const url of attempts){
    try{
      const response = await fetch(url)
      if(!response.ok){
        continue
      }
      const raw = await response.text()
      if(!raw){
        continue
      }
      let transcript = ""
      if(url.includes("fmt=json3")){
        const data = JSON.parse(raw)
        transcript = transcriptFromJson3(data)
      }else{
        transcript = transcriptFromXml(raw)
      }
      if(transcript){
        return transcript.slice(0, 18000)
      }
    }catch(_error){
      // Try next source.
    }
  }
  return ""
}

function splitIntoSentences(text){
  return `${text || ""}`
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map(item => item.trim())
    .filter(item => item.length >= 40 && item.length <= 240)
}

function pickKeyTerms(text, limit = 12){
  const stop = new Set([
    "about", "after", "again", "along", "also", "because", "before", "being", "between",
    "could", "every", "first", "from", "have", "into", "just", "like", "many", "more",
    "most", "other", "should", "their", "there", "these", "they", "this", "those", "through",
    "under", "using", "very", "what", "when", "where", "which", "while", "with", "your"
  ])
  const counts = new Map()
  const words = `${text || ""}`.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || []
  for(const word of words){
    if(stop.has(word)){
      continue
    }
    counts.set(word, (counts.get(word) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(item => item[0])
}

function buildTranscriptBasedQuizPack(input, transcript){
  const sentences = splitIntoSentences(transcript)
  const keyTerms = pickKeyTerms(transcript, 12)

  const flashcards = keyTerms.slice(0, 10).map((term, index) => {
    const sentence = sentences.find(item => item.toLowerCase().includes(term)) || sentences[index] || ""
    return {
      prompt: `In ${input.videoTitle}, what does "${term}" refer to?`,
      answer: sentence || `The lesson discusses ${term} as an important concept in ${input.pathTitle}.`,
      hint: `Recall the section where ${term} was introduced.`
    }
  })

  const baseSentences = sentences.slice(0, 20)
  const quizItems = baseSentences.slice(0, 5).map((correctText, index) => {
    const distractors = baseSentences
      .filter((item, itemIndex) => itemIndex !== index)
      .slice(0, 3)
    const paddedDistractors = [...distractors]
    while(paddedDistractors.length < 3){
      paddedDistractors.push(`This option is not directly stated in the lesson transcript (${paddedDistractors.length + 1}).`)
    }
    const options = [correctText, ...paddedDistractors]
      .map(item => item.length > 140 ? `${item.slice(0, 137)}...` : item)
      .sort(() => Math.random() - 0.5)
    const correctIndex = options.findIndex(option => option.startsWith(correctText.slice(0, 20)))
    return {
      question: `Which statement best matches what the lesson teaches?`,
      options,
      correctIndex: Math.max(0, correctIndex),
      explanation: "Correct choice reflects the actual transcript content."
    }
  })

  return {
    title: `${input.videoTitle} Flashcards`,
    summary: `Generated from YouTube lesson transcript for ${input.pathTitle}.`,
    flashcards: flashcards.length > 0 ? flashcards : fallbackVideoQuiz(input).flashcards,
    quizItems: quizItems.length > 0
      ? quizItems
      : buildQuizFromFlashcards(flashcards.length > 0 ? flashcards : fallbackVideoQuiz(input).flashcards)
  }
}

function normalizeQuizItem(item){
  const options = sanitizeList(item?.options, ["Option A", "Option B", "Option C", "Option D"]).slice(0, 4)
  const correctIndexRaw = Number(item?.correctIndex)
  const correctIndex = Number.isNaN(correctIndexRaw) ? 0 : Math.min(Math.max(correctIndexRaw, 0), Math.max(0, options.length - 1))
  return {
    question: sanitizeText(item?.question, "Select the best answer."),
    options,
    correctIndex,
    explanation: sanitizeText(item?.explanation, "Review this concept from your lesson.")
  }
}

function buildQuizFromFlashcards(flashcards){
  const cards = Array.isArray(flashcards) ? flashcards : []
  return cards.slice(0, 5).map(card => {
    const correct = sanitizeText(card?.answer, "Answer not provided")
    const options = [
      correct,
      "This topic has no practical usage.",
      "The concept is unrelated to the current subject.",
      "Only memorize terms; understanding is unnecessary."
    ].slice(0, 4)
    return {
      question: sanitizeText(card?.prompt, "Select the best answer."),
      options,
      correctIndex: 0,
      explanation: sanitizeText(card?.hint, "Review this concept from the flashcard.")
    }
  })
}

function extractFlashcardsFromPayload(payload, fallbackCards){
  const rawCards = Array.isArray(payload?.flashcards)
    ? payload.flashcards
    : Array.isArray(payload?.questions)
      ? payload.questions
      : []
  const cards = rawCards.map(normalizeFlashcard).slice(0, 12)
  return cards.length > 0 ? cards : fallbackCards
}

function normalizeVideoQuiz(payload, input){
  const fallback = fallbackVideoQuiz(input)
  if(!payload || typeof payload !== "object"){
    return fallback
  }
  const flashcards = extractFlashcardsFromPayload(payload, fallback.flashcards)
  const rawQuiz = Array.isArray(payload.quizItems) ? payload.quizItems : []
  const quizItems = rawQuiz.map(normalizeQuizItem).slice(0, 8)
  return {
    title: sanitizeText(payload.title, fallback.title),
    summary: sanitizeText(payload.summary, fallback.summary),
    flashcards,
    quizItems: quizItems.length > 0 ? quizItems : buildQuizFromFlashcards(flashcards)
  }
}

async function generateVideoQuiz(input){
  const transcript = await fetchYouTubeTranscript(input.videoUrl)
  const hasTranscript = Boolean(transcript)
  const transcriptPack = hasTranscript ? buildTranscriptBasedQuizPack(input, transcript) : fallbackVideoQuiz(input)

  if(!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY){
    return { quiz: transcriptPack, source: hasTranscript ? "transcript" : "topic" }
  }

  const prompt = hasTranscript
    ? [
      "Generate subject-based study flashcards and quiz as strict JSON only.",
      "Return object keys: title, summary, flashcards, quizItems.",
      "flashcards must be an array of 8 to 12 objects.",
      "Each flashcard object keys: prompt, answer, hint.",
      "quizItems must be an array of 5 objects with keys: question, options, correctIndex, explanation.",
      "Each quiz item should have 4 options and a valid 0-based correctIndex.",
      "Keep answers concise and interview-useful.",
      "No markdown and no extra keys.",
      "",
      `pathTitle: ${input.pathTitle}`,
      `videoTitle: ${input.videoTitle}`,
      `videoSubdomain: ${input.videoSubdomain}`,
      `videoTags: ${(input.videoTags || []).join(", ")}`,
      `pathTags: ${(input.pathTags || []).join(", ")}`,
      `transcript: ${transcript.slice(0, 12000)}`
    ].join("\n")
    : [
      "Generate subject-based study flashcards and quiz as strict JSON only.",
      "Captions/transcript are unavailable, so infer from the topic title and path context.",
      "Return object keys: title, summary, flashcards, quizItems.",
      "flashcards must be an array of 8 to 12 objects.",
      "Each flashcard object keys: prompt, answer, hint.",
      "quizItems must be an array of 5 objects with keys: question, options, correctIndex, explanation.",
      "Each quiz item should have 4 options and a valid 0-based correctIndex.",
      "Keep answers practical for interviews and project usage.",
      "No markdown and no extra keys.",
      "",
      `pathTitle: ${input.pathTitle}`,
      `videoTitle: ${input.videoTitle}`,
      `videoSubdomain: ${input.videoSubdomain}`,
      `videoTags: ${(input.videoTags || []).join(", ")}`,
      `pathTags: ${(input.pathTags || []).join(", ")}`
    ].join("\n")

  try{
    const result = await generateStructuredJson(prompt)
    if(!result.ok){
      return { quiz: transcriptPack, source: hasTranscript ? "transcript" : "topic" }
    }
    const parsed = JSON.parse(stripCodeFence(result.text))
    return { quiz: normalizeVideoQuiz(parsed, input), source: hasTranscript ? result.provider : "topic" }
  }catch(_error){
    return { quiz: transcriptPack, source: hasTranscript ? "transcript" : "topic" }
  }
}

function parseJsonObjectColumn(value){
  if(value && typeof value === "object" && !Array.isArray(value)){
    return value
  }
  if(typeof value === "string"){
    try{
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
    }catch(_error){
      return {}
    }
  }
  return {}
}

function parseJsonColumn(value){
  if(Array.isArray(value)){
    return value
  }
  if(typeof value === "string"){
    try{
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    }catch(_error){
      return []
    }
  }
  return []
}

function dateToYMD(value){
  if(!value){
    return ""
  }
  if(value instanceof Date){
    return zonedYMD(value)
  }
  const raw = `${value}`.trim()
  const direct = raw.slice(0, 10)
  if(/^\d{4}-\d{2}-\d{2}$/.test(direct)){
    return direct
  }
  const parsed = new Date(raw)
  if(!Number.isNaN(parsed.getTime())){
    return zonedYMD(parsed)
  }
  return ""
}

function zonedYMD(date){
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date)
  const year = parts.find(item => item.type === "year")?.value
  const month = parts.find(item => item.type === "month")?.value
  const day = parts.find(item => item.type === "day")?.value
  return `${year}-${month}-${day}`
}

function todayYMD(){
  return zonedYMD(new Date())
}

function ymdMinusDays(ymd, days){
  const [year, month, day] = `${ymd}`.split("-").map(Number)
  if(!year || !month || !day){
    return ymd
  }
  const base = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  base.setUTCDate(base.getUTCDate() - days)
  const y = base.getUTCFullYear()
  const m = `${base.getUTCMonth() + 1}`.padStart(2, "0")
  const d = `${base.getUTCDate()}`.padStart(2, "0")
  return `${y}-${m}-${d}`
}

function yesterdayYMD(){
  return ymdMinusDays(todayYMD(), 1)
}

function buildBadges({ totalXp, currentStreak, watchedVideos, completedPaths }){
  const badges = []
  if(watchedVideos >= 1){
    badges.push({
      id: "first_video",
      label: "First Video Watched",
      description: "You completed your first watch milestone."
    })
  }
  if(totalXp >= 100){
    badges.push({
      id: "xp_starter",
      label: "XP Starter",
      description: "Reached 100 XP."
    })
  }
  if(totalXp >= 500){
    badges.push({
      id: "xp_champion",
      label: "XP Champion",
      description: "Reached 500 XP."
    })
  }
  if(currentStreak >= 7){
    badges.push({
      id: "streak_7",
      label: "7-Day Streak",
      description: "Learned consistently for a week."
    })
  }
  if(completedPaths >= 1){
    badges.push({
      id: "path_finisher",
      label: "Path Finisher",
      description: "Completed your first learning path."
    })
  }
  if(completedPaths >= 3){
    badges.push({
      id: "path_master",
      label: "Path Master",
      description: "Completed 3 learning paths."
    })
  }
  return badges
}

async function ensureGamificationRow(userId){
  await dbQuery(
    "INSERT IGNORE INTO user_gamification (user_id, badges_json) VALUES (?, ?)",
    [userId, JSON.stringify([])]
  )
}

async function computeStreaksFromEvents(userId){
  const rows = await dbQuery(
    `SELECT created_at
     FROM xp_events
     WHERE user_id = ?
     ORDER BY created_at ASC
     LIMIT 1000`,
    [userId]
  )

  const uniqueDays = [...new Set(rows.map(row => dateToYMD(row.created_at)).filter(Boolean))].sort()
  if(uniqueDays.length === 0){
    return { currentStreak: 0, longestStreak: 0 }
  }

  let longest = 1
  let running = 1
  for(let i = 1; i < uniqueDays.length; i += 1){
    const prev = uniqueDays[i - 1]
    const expected = ymdMinusDays(uniqueDays[i], 1)
    if(prev === expected){
      running += 1
    }else{
      running = 1
    }
    if(running > longest){
      longest = running
    }
  }

  const today = todayYMD()
  let current = 0
  if(uniqueDays.includes(today)){
    current = 1
    let probe = today
    while(true){
      const previous = ymdMinusDays(probe, 1)
      if(uniqueDays.includes(previous)){
        current += 1
        probe = previous
      }else{
        break
      }
    }
  }

  return {
    currentStreak: current,
    longestStreak: Math.max(longest, current)
  }
}

async function fetchUserLearningCounts(userId){
  const [watchedRows, completedRows] = await Promise.all([
    dbQuery(
      "SELECT COUNT(*) AS count FROM user_video_progress WHERE user_id = ?",
      [userId]
    ),
    dbQuery(
      "SELECT COUNT(*) AS count FROM user_path_completion WHERE user_id = ?",
      [userId]
    )
  ])
  return {
    watchedVideos: Number(watchedRows[0]?.count || 0),
    completedPaths: Number(completedRows[0]?.count || 0)
  }
}

async function grantXp(userId, { eventType, points, pathId = null, videoId = null }){
  const insertResult = await dbQuery(
    `INSERT IGNORE INTO xp_events (user_id, event_type, points, path_id, video_id)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, eventType, points, pathId, videoId]
  )
  if(Number(insertResult.affectedRows || 0) === 0){
    return { awarded: false }
  }

  await ensureGamificationRow(userId)
  const rows = await dbQuery(
    `SELECT total_xp, current_streak, longest_streak, last_active_date
     FROM user_gamification
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  )
  const row = rows[0] || {
    total_xp: 0,
    current_streak: 0,
    longest_streak: 0,
    last_active_date: null
  }

  const totalXp = Number(row.total_xp || 0) + points
  const counts = await fetchUserLearningCounts(userId)
  const streaks = await computeStreaksFromEvents(userId)
  const currentStreak = streaks.currentStreak
  const longestStreak = streaks.longestStreak
  const today = todayYMD()
  const badges = buildBadges({
    totalXp,
    currentStreak,
    watchedVideos: counts.watchedVideos,
    completedPaths: counts.completedPaths
  })

  await dbQuery(
    `UPDATE user_gamification
     SET total_xp = ?, current_streak = ?, longest_streak = ?, last_active_date = ?, badges_json = ?
     WHERE user_id = ?`,
    [totalXp, currentStreak, longestStreak, today, JSON.stringify(badges), userId]
  )

  return { awarded: true, points, totalXp }
}

async function getGamificationSummary(userId){
  await ensureGamificationRow(userId)
  const rows = await dbQuery(
    `SELECT u.name, g.total_xp, g.current_streak, g.longest_streak, g.badges_json
     FROM users u
     LEFT JOIN user_gamification g ON g.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  )
  const row = rows[0] || {}
  const streaks = await computeStreaksFromEvents(userId)
  if(
    Number(row?.current_streak || 0) !== streaks.currentStreak ||
    Number(row?.longest_streak || 0) !== streaks.longestStreak
  ){
    await dbQuery(
      `UPDATE user_gamification
       SET current_streak = ?, longest_streak = ?
       WHERE user_id = ?`,
      [streaks.currentStreak, streaks.longestStreak, userId]
    )
  }

  const totalXp = Number(row?.total_xp || 0)
  const currentStreak = streaks.currentStreak
  const currentName = sanitizeText(row?.name, "")
  const rankRows = await dbQuery(
    `SELECT COUNT(*) + 1 AS position_rank
     FROM users u
     LEFT JOIN user_gamification g ON g.user_id = u.id
     WHERE
       COALESCE(g.total_xp, 0) > ?
       OR (
         COALESCE(g.total_xp, 0) = ?
         AND COALESCE(g.current_streak, 0) > ?
       )
       OR (
         COALESCE(g.total_xp, 0) = ?
         AND COALESCE(g.current_streak, 0) = ?
         AND u.name < ?
       )`,
    [totalXp, totalXp, currentStreak, totalXp, currentStreak, currentName]
  )
  const rank = Number(rankRows[0]?.position_rank || 1)

  return {
    totalXp,
    currentStreak,
    longestStreak: streaks.longestStreak,
    badges: parseJsonColumn(row?.badges_json),
    rank
  }
}

async function getLeaderboard(limit = 10){
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10))
  const rows = await dbQuery(
    `SELECT u.name, COALESCE(g.total_xp, 0) AS total_xp, COALESCE(g.current_streak, 0) AS current_streak
     FROM users u
     LEFT JOIN user_gamification g ON g.user_id = u.id
     ORDER BY COALESCE(g.total_xp, 0) DESC, COALESCE(g.current_streak, 0) DESC, u.name ASC
     LIMIT ${safeLimit}`
  )
  return rows.map((row, index) => ({
    rank: index + 1,
    name: row.name,
    totalXp: Number(row.total_xp || 0),
    currentStreak: Number(row.current_streak || 0)
  }))
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

async function getPathProgressPrediction(userId, pathId){
  const selectedPath = PATHS_BY_ID[pathId]
  if(!selectedPath){
    return null
  }

  const totalVideos = selectedPath.videos.length
  const rows = await dbQuery(
    `SELECT video_id, watched_at
     FROM user_video_progress
     WHERE user_id = ? AND path_id = ?
     ORDER BY watched_at ASC`,
    [userId, pathId]
  )

  const watchedCount = rows.length
  const remainingVideos = Math.max(0, totalVideos - watchedCount)
  if(remainingVideos === 0){
    return {
      completed: true,
      estimatedDaysToComplete: 0,
      currentVideosPerDay: 0,
      paceDropPercent: 0,
      suggestedVideosPerDay: 0
    }
  }
  if(watchedCount === 0){
    return {
      completed: false,
      estimatedDaysToComplete: totalVideos,
      currentVideosPerDay: 0,
      paceDropPercent: 0,
      suggestedVideosPerDay: 1
    }
  }

  const now = Date.now()
  const current7 = rows.filter(row => {
    const ageDays = (now - new Date(row.watched_at).getTime()) / 86400000
    return ageDays < 7
  }).length
  const previous7 = rows.filter(row => {
    const ageDays = (now - new Date(row.watched_at).getTime()) / 86400000
    return ageDays >= 7 && ageDays < 14
  }).length

  const firstWatchTime = new Date(rows[0].watched_at).getTime()
  const elapsedDays = Math.max(1, (now - firstWatchTime) / 86400000)
  const overallPace = watchedCount / elapsedDays
  const currentVideosPerDay = Number((current7 / 7).toFixed(2))
  const effectivePace = Math.max(currentVideosPerDay, overallPace * 0.7, 0.15)
  const estimatedDaysToComplete = Math.max(1, Math.ceil(remainingVideos / effectivePace))
  const paceDropPercent = previous7 > 0
    ? Math.max(0, Math.round(((previous7 - current7) / previous7) * 100))
    : 0

  let suggestedVideosPerDay = Math.max(
    1,
    Math.ceil(remainingVideos / Math.max(7, Math.min(21, estimatedDaysToComplete)))
  )
  if(paceDropPercent >= 20){
    suggestedVideosPerDay = Math.max(2, suggestedVideosPerDay)
  }

  return {
    completed: false,
    estimatedDaysToComplete,
    currentVideosPerDay,
    paceDropPercent,
    suggestedVideosPerDay
  }
}

function addDaysToYmd(ymd, days){
  const [year, month, day] = `${ymd}`.split("-").map(Number)
  if(!year || !month || !day){
    return ymd
  }
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function weekStartMondayYmd(input){
  if(input && /^\d{4}-\d{2}-\d{2}$/.test(`${input}`.trim())){
    return `${input}`.trim()
  }
  const now = new Date()
  const offsetDate = new Date(now.toLocaleString("en-US", { timeZone: APP_TIMEZONE }))
  const day = offsetDate.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  offsetDate.setDate(offsetDate.getDate() + diffToMonday)
  return offsetDate.toISOString().slice(0, 10)
}

function normalizePlannerPriority(value){
  const normalized = sanitizeText(value, "medium").toLowerCase()
  return ["low", "medium", "high"].includes(normalized) ? normalized : "medium"
}

function normalizePlannerStatus(value){
  const normalized = sanitizeText(value, "pending").toLowerCase()
  return ["pending", "completed", "skipped"].includes(normalized) ? normalized : "pending"
}

function normalizeReminderMinutes(value){
  const n = Number(value)
  if(Number.isNaN(n)){
    return 10
  }
  return Math.max(1, Math.min(1440, Math.round(n)))
}

function normalizeDurationMinutes(value){
  const n = Number(value)
  if(Number.isNaN(n)){
    return 30
  }
  return Math.max(5, Math.min(720, Math.round(n)))
}

function normalizePlannerDateTime(value){
  if(value instanceof Date){
    if(Number.isNaN(value.getTime())){
      return ""
    }
    const y = value.getFullYear()
    const m = `${value.getMonth() + 1}`.padStart(2, "0")
    const d = `${value.getDate()}`.padStart(2, "0")
    const hh = `${value.getHours()}`.padStart(2, "0")
    const mm = `${value.getMinutes()}`.padStart(2, "0")
    const ss = `${value.getSeconds()}`.padStart(2, "0")
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
  }
  const raw = typeof value === "string" ? value.trim() : ""
  if(!raw){
    return ""
  }
  const parsed = new Date(raw)
  if(Number.isNaN(parsed.getTime())){
    return ""
  }
  const y = parsed.getFullYear()
  const m = `${parsed.getMonth() + 1}`.padStart(2, "0")
  const d = `${parsed.getDate()}`.padStart(2, "0")
  const hh = `${parsed.getHours()}`.padStart(2, "0")
  const mm = `${parsed.getMinutes()}`.padStart(2, "0")
  const ss = `${parsed.getSeconds()}`.padStart(2, "0")
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

function plannerTaskDto(row){
  return {
    id: Number(row.id),
    courseName: row.course_name,
    topic: row.topic,
    durationMin: Number(row.duration_min || 0),
    priority: row.priority,
    status: row.status,
    reminderMinutes: Number(row.reminder_minutes || 10),
    plannedStart: row.planned_start,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function authMiddleware(req, res, next){
  const auth = req.headers.authorization || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if(!token){
    return res.status(401).json({ message: "Unauthorized" })
  }

  try{
    const decoded = jwt.verify(token, JWT_SECRET)
    const rows = await dbQuery(
      "SELECT id, name, email, career_quiz_completed FROM users WHERE id = ? LIMIT 1",
      [decoded.sub]
    )
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
    "INSERT INTO users (id, name, email, password_hash, career_quiz_completed) VALUES (?, ?, ?, ?, ?)",
    [user.id, user.name, user.email, user.passwordHash, 0]
  )
  await ensureGamificationRow(user.id)

  return res.status(201).json({ user: toPublicUser(user) })
})

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {}
  if(!email || !password){
    return res.status(400).json({ message: "Email and password are required" })
  }

  const rows = await dbQuery(
    "SELECT id, name, email, password_hash, career_quiz_completed FROM users WHERE email = ? LIMIT 1",
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
  let gamification = null
  try{
    gamification = await getGamificationSummary(req.user.id)
  }catch(_error){
    gamification = null
  }
  res.json({ ...data, gamification })
})

app.get("/api/progress/prediction", authMiddleware, async (req, res) => {
  const pathId = sanitizeText(req.query.pathId, "")
  if(!pathId){
    return res.status(400).json({ message: "pathId is required" })
  }

  const prediction = await getPathProgressPrediction(req.user.id, pathId)
  if(!prediction){
    return res.status(404).json({ message: "Invalid path" })
  }
  return res.json({ prediction })
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

  const writeResult = await dbQuery(
    "INSERT IGNORE INTO user_video_progress (user_id, path_id, video_id) VALUES (?, ?, ?)",
    [req.user.id, pathId, videoId]
  )
  if(Number(writeResult.affectedRows || 0) > 0){
    try{
      await grantXp(req.user.id, {
        eventType: "watch_video",
        points: 10,
        pathId,
        videoId
      })
    }catch(error){
      console.error("Gamification grant failed (watch_video):", error.message)
      // Keep progress updates functional even if gamification write fails.
    }
  }

  const data = await getProgressByUserId(req.user.id)
  let gamification = null
  try{
    gamification = await getGamificationSummary(req.user.id)
  }catch(_error){
    gamification = null
  }
  return res.json({ ...data, gamification })
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

  await dbQuery(
    "DELETE FROM user_video_progress WHERE user_id = ? AND path_id = ? AND video_id = ?",
    [req.user.id, pathId, videoId]
  )

  // If a user marks any video as unwatched, completion for that path should be removed.
  await dbQuery(
    "DELETE FROM user_path_completion WHERE user_id = ? AND path_id = ?",
    [req.user.id, pathId]
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

  const writeResult = await dbQuery(
    "INSERT IGNORE INTO user_path_completion (user_id, path_id) VALUES (?, ?)",
    [req.user.id, pathId]
  )
  if(Number(writeResult.affectedRows || 0) > 0){
    try{
      await grantXp(req.user.id, {
        eventType: "complete_path",
        points: 200,
        pathId
      })
    }catch(error){
      console.error("Gamification grant failed (complete_path):", error.message)
      // Keep progress updates functional even if gamification write fails.
    }
  }

  const data = await getProgressByUserId(req.user.id)
  let gamification = null
  try{
    gamification = await getGamificationSummary(req.user.id)
  }catch(_error){
    gamification = null
  }
  return res.json({ ...data, gamification })
})

app.get("/api/gamification/summary", authMiddleware, async (req, res) => {
  const summary = await getGamificationSummary(req.user.id)
  const leaderboard = await getLeaderboard(10)
  res.json({ summary, leaderboard })
})

app.get("/api/gamification/leaderboard", authMiddleware, async (req, res) => {
  const leaderboard = await getLeaderboard(req.query.limit)
  res.json({ leaderboard })
})

app.get("/api/study-planner/tasks", authMiddleware, async (req, res) => {
  const weekStart = weekStartMondayYmd(req.query.weekStart)
  const weekEnd = addDaysToYmd(weekStart, 6)
  const rows = await dbQuery(
    `SELECT id, course_name, topic, duration_min, priority, status, reminder_minutes, planned_start, created_at, updated_at
     FROM study_planner_tasks
     WHERE user_id = ? AND DATE(planned_start) BETWEEN ? AND ?
     ORDER BY planned_start ASC`,
    [req.user.id, weekStart, weekEnd]
  )
  res.json({ weekStart, weekEnd, tasks: rows.map(plannerTaskDto) })
})

app.get("/api/study-planner/summary", authMiddleware, async (req, res) => {
  const weekStart = weekStartMondayYmd(req.query.weekStart)
  const weekEnd = addDaysToYmd(weekStart, 6)
  const rows = await dbQuery(
    `SELECT status, planned_start
     FROM study_planner_tasks
     WHERE user_id = ? AND DATE(planned_start) BETWEEN ? AND ?`,
    [req.user.id, weekStart, weekEnd]
  )
  const now = Date.now()
  const totalPlanned = rows.length
  const completedSessions = rows.filter(item => item.status === "completed").length
  const skippedSessions = rows.filter(item => item.status === "skipped").length
  const missedSessions = rows.filter(item => {
    if(item.status !== "pending"){
      return false
    }
    const plannedTime = new Date(item.planned_start).getTime()
    return !Number.isNaN(plannedTime) && plannedTime < now
  }).length
  res.json({
    weekStart,
    weekEnd,
    summary: { totalPlanned, completedSessions, skippedSessions, missedSessions }
  })
})

app.get("/api/study-planner/reminders", authMiddleware, async (req, res) => {
  const horizonMinutes = Math.max(5, Math.min(240, Number(req.query.horizonMinutes) || 60))
  const rows = await dbQuery(
    `SELECT id, course_name, topic, duration_min, priority, status, reminder_minutes, planned_start, created_at, updated_at
     FROM study_planner_tasks
     WHERE user_id = ? AND status = 'pending'
     ORDER BY planned_start ASC
     LIMIT 100`,
    [req.user.id]
  )
  const now = Date.now()
  const horizonMs = horizonMinutes * 60 * 1000
  const reminders = rows.filter(row => {
    const plannedMs = new Date(row.planned_start).getTime()
    if(Number.isNaN(plannedMs) || plannedMs < now){
      return false
    }
    const msUntilStart = plannedMs - now
    const reminderWindow = Number(row.reminder_minutes || 10) * 60 * 1000
    return msUntilStart <= Math.max(reminderWindow, horizonMs)
  }).map(plannerTaskDto)
  res.json({ reminders })
})

app.post("/api/study-planner/tasks", authMiddleware, async (req, res) => {
  const payload = req.body || {}
  const courseName = sanitizeText(payload.courseName, "")
  const topic = sanitizeText(payload.topic, "")
  const plannedStart = normalizePlannerDateTime(payload.plannedStart)
  if(!courseName || !topic || !plannedStart){
    return res.status(400).json({ message: "courseName, topic, and plannedStart are required" })
  }

  const insertResult = await dbQuery(
    `INSERT INTO study_planner_tasks
      (user_id, course_name, topic, duration_min, priority, status, reminder_minutes, planned_start)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.id,
      courseName,
      topic,
      normalizeDurationMinutes(payload.durationMin),
      normalizePlannerPriority(payload.priority),
      normalizePlannerStatus(payload.status),
      normalizeReminderMinutes(payload.reminderMinutes),
      plannedStart
    ]
  )
  const rows = await dbQuery(
    `SELECT id, course_name, topic, duration_min, priority, status, reminder_minutes, planned_start, created_at, updated_at
     FROM study_planner_tasks
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [insertResult.insertId, req.user.id]
  )
  res.status(201).json({ task: plannerTaskDto(rows[0]) })
})

app.put("/api/study-planner/tasks/:id", authMiddleware, async (req, res) => {
  const taskId = Number(req.params.id)
  if(Number.isNaN(taskId) || taskId <= 0){
    return res.status(400).json({ message: "Invalid task id" })
  }
  const rows = await dbQuery(
    `SELECT id, course_name, topic, duration_min, priority, status, reminder_minutes, planned_start
     FROM study_planner_tasks
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [taskId, req.user.id]
  )
  const current = rows[0]
  if(!current){
    return res.status(404).json({ message: "Task not found" })
  }

  const payload = req.body || {}
  const courseName = sanitizeText(payload.courseName, current.course_name)
  const topic = sanitizeText(payload.topic, current.topic)
  const plannedStart = payload.plannedStart
    ? normalizePlannerDateTime(payload.plannedStart)
    : normalizePlannerDateTime(current.planned_start)
  if(!courseName || !topic || !plannedStart){
    return res.status(400).json({ message: "Invalid task payload" })
  }

  await dbQuery(
    `UPDATE study_planner_tasks
     SET course_name = ?, topic = ?, duration_min = ?, priority = ?, status = ?, reminder_minutes = ?, planned_start = ?
     WHERE id = ? AND user_id = ?`,
    [
      courseName,
      topic,
      normalizeDurationMinutes(payload.durationMin ?? current.duration_min),
      normalizePlannerPriority(payload.priority ?? current.priority),
      normalizePlannerStatus(payload.status ?? current.status),
      normalizeReminderMinutes(payload.reminderMinutes ?? current.reminder_minutes),
      plannedStart,
      taskId,
      req.user.id
    ]
  )
  const updated = await dbQuery(
    `SELECT id, course_name, topic, duration_min, priority, status, reminder_minutes, planned_start, created_at, updated_at
     FROM study_planner_tasks
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [taskId, req.user.id]
  )
  res.json({ task: plannerTaskDto(updated[0]) })
})

app.delete("/api/study-planner/tasks/:id", authMiddleware, async (req, res) => {
  const taskId = Number(req.params.id)
  if(Number.isNaN(taskId) || taskId <= 0){
    return res.status(400).json({ message: "Invalid task id" })
  }
  await dbQuery("DELETE FROM study_planner_tasks WHERE id = ? AND user_id = ?", [taskId, req.user.id])
  res.json({ ok: true })
})

app.get("/api/ai/path/latest", authMiddleware, async (req, res) => {
  const rows = await dbQuery(
    `SELECT id, path_title, path_summary, career_goal, current_level, hours_per_week, learning_style,
      timeline_weeks, roadmap_json, created_at
     FROM generated_learning_paths
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [req.user.id]
  )

  const row = rows[0]
  if(!row){
    return res.json({ path: null })
  }

  return res.json({
    path: {
      id: row.id,
      title: row.path_title,
      summary: row.path_summary,
      careerGoal: row.career_goal,
      currentLevel: row.current_level,
      hoursPerWeek: row.hours_per_week,
      learningStyle: row.learning_style,
      timelineWeeks: row.timeline_weeks,
      phases: parseJsonColumn(row.roadmap_json),
      createdAt: row.created_at
    }
  })
})

app.post("/api/ai/path/generate", authMiddleware, async (req, res) => {
  const payload = req.body || {}
  const careerGoal = sanitizeText(payload.careerGoal, "")
  const currentLevel = sanitizeText(payload.currentLevel, "Beginner")
  const learningStyle = sanitizeText(payload.learningStyle, "balanced")
  const hoursPerWeek = Number(payload.hoursPerWeek)

  if(!careerGoal){
    return res.status(400).json({ message: "careerGoal is required" })
  }
  if(Number.isNaN(hoursPerWeek) || hoursPerWeek < 1 || hoursPerWeek > 80){
    return res.status(400).json({ message: "hoursPerWeek must be between 1 and 80" })
  }

  const input = { careerGoal, currentLevel, learningStyle, hoursPerWeek }
  const result = await generateLearningRoadmap(input)
  const roadmap = result.roadmap

  const insertResult = await dbQuery(
    `INSERT INTO generated_learning_paths
      (user_id, path_title, path_summary, career_goal, current_level, hours_per_week, learning_style, timeline_weeks, roadmap_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.id,
      roadmap.title,
      roadmap.summary,
      careerGoal,
      currentLevel,
      hoursPerWeek,
      learningStyle,
      roadmap.timelineWeeks,
      JSON.stringify(roadmap.phases)
    ]
  )
  return res.status(201).json({
    path: {
      id: insertResult.insertId,
      careerGoal,
      currentLevel,
      hoursPerWeek,
      learningStyle,
      title: roadmap.title,
      summary: roadmap.summary,
      timelineWeeks: roadmap.timelineWeeks,
      phases: roadmap.phases
    },
    source: result.source
  })
})

app.get("/api/ai/skill-gap/latest", authMiddleware, async (req, res) => {
  const [rows, reviewRows] = await Promise.all([
    dbQuery(
      `SELECT id, target_role, resume_text, provided_skills_json, job_description, analysis_summary,
      strengths_json, missing_skills_json, recommendations_json, recommended_paths_json, created_at
     FROM skill_gap_reports
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
      [req.user.id]
    ),
    dbQuery(
      `SELECT ats_score, summary, strengths_json, changes_json, keyword_gaps_json, rewritten_bullets_json, created_at
       FROM resume_review_reports
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.id]
    )
  ])

  const row = rows[0]
  if(!row){
    return res.json({ report: null })
  }
  const review = reviewRows[0]

  return res.json({
    report: {
      id: row.id,
      targetRole: row.target_role,
      resumeText: row.resume_text,
      providedSkills: parseJsonColumn(row.provided_skills_json),
      jobDescription: row.job_description,
      summary: row.analysis_summary,
      strengths: parseJsonColumn(row.strengths_json),
      missingSkills: parseJsonColumn(row.missing_skills_json),
      recommendations: parseJsonColumn(row.recommendations_json),
      recommendedPaths: parseJsonColumn(row.recommended_paths_json),
      resumeReview: review ? {
        atsScore: Number(review.ats_score || 0),
        summary: review.summary,
        strengths: parseJsonColumn(review.strengths_json),
        changesNeeded: parseJsonColumn(review.changes_json),
        keywordGaps: parseJsonColumn(review.keyword_gaps_json),
        rewrittenBullets: parseJsonColumn(review.rewritten_bullets_json),
        createdAt: review.created_at
      } : null,
      createdAt: row.created_at
    }
  })
})

app.post("/api/ai/skill-gap/analyze", authMiddleware, async (req, res) => {
  const payload = req.body || {}
  const targetRole = sanitizeText(payload.targetRole, "")
  const providedSkillsText = sanitizeText(payload.providedSkillsText, "")
  const resumeText = sanitizeText(payload.resumeText, "")
  const jobDescription = sanitizeText(payload.jobDescription, "")

  if(!targetRole){
    return res.status(400).json({ message: "targetRole is required" })
  }
  if(!resumeText && !providedSkillsText){
    return res.status(400).json({ message: "Provide resume text or skills list" })
  }

  const input = { targetRole, providedSkillsText, resumeText, jobDescription }
  const result = await generateSkillGapAnalysis(input)
  const analysis = result.analysis
  const reviewResult = await generateResumeReview(input, analysis)
  const resumeReview = reviewResult.review
  const providedSkills = dedupeStrings(tokenizeSkills(providedSkillsText))

  const insertResult = await dbQuery(
    `INSERT INTO skill_gap_reports
      (user_id, target_role, resume_text, provided_skills_json, job_description, analysis_summary,
       strengths_json, missing_skills_json, recommendations_json, recommended_paths_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.id,
      targetRole,
      resumeText,
      JSON.stringify(providedSkills),
      jobDescription,
      analysis.summary,
      JSON.stringify(analysis.strengths),
      JSON.stringify(analysis.missingSkills),
      JSON.stringify(analysis.recommendations),
      JSON.stringify(analysis.recommendedPaths)
    ]
  )
  await dbQuery(
    `INSERT INTO resume_review_reports
      (user_id, target_role, job_description, ats_score, summary, strengths_json, changes_json, keyword_gaps_json, rewritten_bullets_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.id,
      targetRole,
      jobDescription,
      resumeReview.atsScore,
      resumeReview.summary,
      JSON.stringify(resumeReview.strengths),
      JSON.stringify(resumeReview.changesNeeded),
      JSON.stringify(resumeReview.keywordGaps),
      JSON.stringify(resumeReview.rewrittenBullets)
    ]
  )

  return res.status(201).json({
    report: {
      id: insertResult.insertId,
      targetRole,
      resumeText,
      providedSkills,
      jobDescription,
      summary: analysis.summary,
      strengths: analysis.strengths,
      missingSkills: analysis.missingSkills,
      recommendations: analysis.recommendations,
      recommendedPaths: analysis.recommendedPaths,
      resumeReview
    },
    source: result.source,
    resumeReviewSource: reviewResult.source
  })
})

app.get("/api/ai/career-recommend/latest", authMiddleware, async (req, res) => {
  const rows = await dbQuery(
    `SELECT id, answers_json, analysis_summary, matches_json, recommended_paths_json, created_at
     FROM career_recommendations
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [req.user.id]
  )

  const row = rows[0]
  if(!row){
    return res.json({ recommendation: null })
  }

  return res.json({
    recommendation: {
      id: row.id,
      answers: parseJsonObjectColumn(row.answers_json),
      summary: row.analysis_summary,
      matches: parseJsonColumn(row.matches_json),
      recommendedPaths: parseJsonColumn(row.recommended_paths_json),
      createdAt: row.created_at
    }
  })
})

app.post("/api/ai/career-recommend", authMiddleware, async (req, res) => {
  const payload = req.body || {}
  const answers = {
    logicPreference: sanitizeText(payload.logicPreference, "sometimes"),
    uiPreference: sanitizeText(payload.uiPreference, "sometimes"),
    mathPreference: sanitizeText(payload.mathPreference, "sometimes"),
    infraPreference: sanitizeText(payload.infraPreference, "sometimes"),
    collaborationPreference: sanitizeText(payload.collaborationPreference, "sometimes")
  }

  const result = await generateCareerRecommendation(answers)
  const recommendation = result.recommendation

  const insertResult = await dbQuery(
    `INSERT INTO career_recommendations
      (user_id, answers_json, analysis_summary, matches_json, recommended_paths_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      req.user.id,
      JSON.stringify(answers),
      recommendation.summary,
      JSON.stringify(recommendation.matches),
      JSON.stringify(recommendation.recommendedPaths)
    ]
  )
  await dbQuery("UPDATE users SET career_quiz_completed = 1 WHERE id = ?", [req.user.id])

  return res.status(201).json({
    recommendation: {
      id: insertResult.insertId,
      answers,
      summary: recommendation.summary,
      matches: recommendation.matches,
      recommendedPaths: recommendation.recommendedPaths
    },
    source: result.source
  })
})

app.get("/api/ai/quiz/latest", authMiddleware, async (req, res) => {
  const pathId = sanitizeText(req.query.pathId, "")
  const videoId = sanitizeText(req.query.videoId, "")
  if(!pathId || !videoId){
    return res.status(400).json({ message: "pathId and videoId are required" })
  }

  const rows = await dbQuery(
    `SELECT id, path_id, video_id, video_title, quiz_json, created_at
     FROM video_quiz_generations
     WHERE user_id = ? AND path_id = ? AND video_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [req.user.id, pathId, videoId]
  )
  const row = rows[0]
  if(!row){
    return res.json({ quiz: null })
  }

  const parsedQuiz = parseJsonObjectColumn(row.quiz_json)
  const pathMeta = PATHS_BY_ID[row.path_id]
  const fallbackCards = fallbackVideoQuiz({
    pathTitle: pathMeta?.title || "",
    pathTags: pathMeta?.tags || [],
    videoTitle: row.video_title,
    videoSubdomain: "",
    videoTags: []
  }).flashcards
  const flashcards = extractFlashcardsFromPayload(parsedQuiz, fallbackCards)
  const quizItemsRaw = (Array.isArray(parsedQuiz.quizItems) ? parsedQuiz.quizItems : []).map(normalizeQuizItem)
  return res.json({
    quiz: {
      id: row.id,
      pathId: row.path_id,
      videoId: row.video_id,
      videoTitle: row.video_title,
      title: sanitizeText(parsedQuiz.title, `${row.video_title} Flashcards`),
      summary: sanitizeText(parsedQuiz.summary, ""),
      flashcards,
      quizItems: quizItemsRaw.length > 0 ? quizItemsRaw : buildQuizFromFlashcards(flashcards),
      createdAt: row.created_at
    }
  })
})

app.post("/api/ai/quiz/generate", authMiddleware, async (req, res) => {
  const payload = req.body || {}
  const pathId = sanitizeText(payload.pathId, "")
  const videoId = sanitizeText(payload.videoId, "")
  const videoTitleFromClient = sanitizeText(payload.videoTitle, "")
  if(!pathId || !videoId){
    return res.status(400).json({ message: "pathId and videoId are required" })
  }

  const selectedPath = PATHS_BY_ID[pathId]
  if(!selectedPath){
    return res.status(404).json({ message: "Invalid path" })
  }
  const video = selectedPath.videos.find(item => item.id === videoId)
  const effectiveVideo = video || {
    id: videoId,
    title: videoTitleFromClient || videoId.replace(/[-_]/g, " "),
    subdomain: "General",
    url: "",
    tags: selectedPath.tags || []
  }

  const input = {
    pathId,
    pathTitle: selectedPath.title,
    pathTags: selectedPath.tags || [],
    videoId: effectiveVideo.id,
    videoTitle: effectiveVideo.title,
    videoSubdomain: effectiveVideo.subdomain || "",
    videoTags: effectiveVideo.tags || [],
    videoUrl: effectiveVideo.url || ""
  }
  let result
  try{
    result = await generateVideoQuiz(input)
  }catch(error){
    const quiz = fallbackVideoQuiz(input)
    const insertResult = await dbQuery(
      `INSERT INTO video_quiz_generations
        (user_id, path_id, video_id, video_title, quiz_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.user.id,
        pathId,
        videoId,
        effectiveVideo.title,
        JSON.stringify(quiz)
      ]
    )

    return res.status(201).json({
      quiz: {
        id: insertResult.insertId,
        pathId,
        videoId,
        videoTitle: video.title,
        title: quiz.title,
        summary: quiz.summary,
        flashcards: quiz.flashcards,
        quizItems: quiz.quizItems || []
      },
      source: "topic",
      warning: error?.message || "Transcript unavailable. Generated topic-based flashcards."
    })
  }
  const quiz = result.quiz

  const insertResult = await dbQuery(
    `INSERT INTO video_quiz_generations
      (user_id, path_id, video_id, video_title, quiz_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      req.user.id,
      pathId,
      videoId,
      video.title,
      JSON.stringify(quiz)
    ]
  )

  return res.status(201).json({
    quiz: {
      id: insertResult.insertId,
      pathId,
      videoId,
      videoTitle: effectiveVideo.title,
      title: quiz.title,
      summary: quiz.summary,
      flashcards: quiz.flashcards,
      quizItems: quiz.quizItems || []
    },
    source: result.source
  })
})

app.get("/api/chat/history", authMiddleware, async (req, res) => {
  // Chat is path-scoped and session-ephemeral on frontend now.
  // Keep endpoint for backward compatibility.
  res.json({ history: [] })
})

app.delete("/api/chat/history", authMiddleware, async (req, res) => {
  // No-op since chat history is not persisted server-side anymore.
  res.json({ history: [] })
})

app.post("/api/chat", authMiddleware, async (req, res) => {
  const { question, pathId } = req.body || {}
  if(!question || typeof question !== "string"){
    return res.status(400).json({ message: "Question is required" })
  }
  // Strict single-turn mentor mode: do not reuse previous chat messages.
  const priorHistory = []
  const systemPrompt = buildMentorSystemPrompt(pathId)

  try{
    const result = await generateMentorChat(priorHistory, question, systemPrompt)
    if(result.ok){
      const history = [{ role: "user", text: question }, { role: "assistant", text: result.answer }]
      return res.json({
        answer: result.answer,
        history,
        source: result.provider,
        degraded: false
      })
    }

    const fallbackAnswer = buildMentorFallbackAnswer(question, pathId)
    const firstReason = result.attempted.find(item => item && !item.ok && item.reason !== "missing_key")
    const fallbackWarning = firstReason
      ? `AI providers unavailable (${firstReason.provider}: ${firstReason.message}). Served mentor fallback response.`
      : "No configured AI provider keys found. Served mentor fallback response."
    const history = [{ role: "user", text: question }, { role: "assistant", text: fallbackAnswer }]
    return res.json({
      answer: fallbackAnswer,
      history,
      source: "fallback",
      degraded: true,
      warning: fallbackWarning
    })
  }catch(error){
    const fallbackAnswer = buildMentorFallbackAnswer(question, pathId)
    const history = [{ role: "user", text: question }, { role: "assistant", text: fallbackAnswer }]
    return res.json({
      answer: fallbackAnswer,
      history,
      source: "fallback",
      degraded: true,
      warning: `AI service unavailable (${error?.message || "network issue"}). Served mentor fallback response.`
    })
  }
})

app.get("*", (_req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, "index.html"))
})

async function start(){
  await initDatabase()
  app.listen(PORT, () => {
    console.log(`Careercraft server running on http://localhost:${PORT}`)
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
