import { PATHS } from "../data/paths.js"
import { apiGet } from "./services/api.js"
import { setSelectedPath } from "./services/session.js"

let progress = { watched: {}, completed: [] }
let stats = {
  totalVideos: PATHS.reduce((sum, item) => sum + item.videos.length, 0),
  watchedVideos: 0,
  remainingVideos: PATHS.reduce((sum, item) => sum + item.videos.length, 0),
  completedPaths: 0,
  totalPaths: PATHS.length
}
let gamification = { xp: 0 }
let badges = { unlockedCount: 0, total: 0, items: [] }
let leaderboard = []

function progressText(path){
  const watchedIds = progress.watched[path.id] || []
  const total = path.videos.length
  const count = watchedIds.length
  const done = progress.completed.includes(path.id)
  if(done){
    return "Completed"
  }
  return `${count}/${total} videos watched`
}

function matchesFilters(path, searchText, level){
  const text = `${path.title} ${path.description} ${path.tags.join(" ")}`.toLowerCase()
  const textOk = !searchText || text.includes(searchText)
  const levelOk = level === "all" || path.level.toLowerCase() === level
  return textOk && levelOk
}

function cardMarkup(path){
  const watchedIds = progress.watched[path.id] || []
  const remaining = Math.max(0, path.videos.length - watchedIds.length)
  return `
    <div class="card">
      <h3>${path.title}</h3>
      <p>${path.description}</p>
      <p class="meta">Level: ${path.level} | Duration: ${path.durationHours}h</p>
      <p class="meta progress">${progressText(path)}</p>
      <p class="meta">Remaining in this path: ${remaining}</p>
      <button data-path-id="${path.id}" class="start-path-btn">Start Path</button>
    </div>
  `
}

function renderStats(){
  const el = document.getElementById("progress-stats")
  el.innerHTML = `
    <article class="stat-card">
      <p>Total Videos</p>
      <h3>${stats.totalVideos}</h3>
    </article>
    <article class="stat-card">
      <p>Watched Videos</p>
      <h3>${stats.watchedVideos}</h3>
    </article>
    <article class="stat-card">
      <p>Remaining Videos</p>
      <h3>${stats.remainingVideos}</h3>
    </article>
    <article class="stat-card">
      <p>Completed Paths</p>
      <h3>${stats.completedPaths}/${stats.totalPaths}</h3>
    </article>
  `
}

function renderGamification(){
  const summaryEl = document.getElementById("gamification-summary")
  summaryEl.innerHTML = `
    <article class="stat-card">
      <p>Total XP</p>
      <h3>${gamification.xp}</h3>
    </article>
    <article class="stat-card">
      <p>Badges Unlocked</p>
      <h3>${badges.unlockedCount}/${badges.total}</h3>
    </article>
  `

  const badgeListEl = document.getElementById("badge-list")
  const items = Array.isArray(badges.items) ? badges.items : []
  if(items.length === 0){
    badgeListEl.innerHTML = `<p class="section-subtitle">No badges available.</p>`
    return
  }
  badgeListEl.innerHTML = items.map(item => `
    <article class="badge-chip">
      <h4>${item.unlocked ? "Unlocked" : "Locked"}: ${item.name}</h4>
      <p>${item.rule}</p>
    </article>
  `).join("")
}

function renderLeaderboard(){
  const el = document.getElementById("leaderboard-list")
  if(leaderboard.length === 0){
    el.innerHTML = `<p class="section-subtitle">No leaderboard data yet.</p>`
    return
  }

  el.innerHTML = leaderboard.map(item => `
    <div class="leaderboard-row">
      <p>#${item.rank} ${item.name}</p>
      <p>XP ${item.xp}</p>
    </div>
  `).join("")
}

function renderCards(){
  const grid = document.getElementById("path-grid")
  const searchText = document.getElementById("path-search").value.trim().toLowerCase()
  const level = document.getElementById("level-filter").value
  const filtered = PATHS.filter(item => matchesFilters(item, searchText, level))

  if(filtered.length === 0){
    grid.innerHTML = `<p class="status error">No paths match this filter.</p>`
    return
  }

  grid.innerHTML = filtered.map(cardMarkup).join("")
  grid.querySelectorAll(".start-path-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      setSelectedPath(btn.dataset.pathId)
      window.location.href = "learn.html"
    })
  })
}

async function init(){
  try{
    const data = await apiGet("/progress")
    progress = data.progress || progress
    stats = data.stats || stats
    gamification = data.gamification || gamification
    badges = data.badges || badges
  }catch(_error){
    // Keep UI usable even when progress is unavailable.
  }

  try{
    const data = await apiGet("/leaderboard")
    leaderboard = data.leaderboard || leaderboard
  }catch(_error){
    // Keep dashboard usable even when leaderboard is unavailable.
  }

  document.getElementById("path-search").addEventListener("input", renderCards)
  document.getElementById("level-filter").addEventListener("change", renderCards)
  renderStats()
  renderGamification()
  renderLeaderboard()
  renderCards()
}

init()
