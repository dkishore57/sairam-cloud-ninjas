import { PATHS } from "../data/paths.js"
import { apiDelete, apiGet, apiPost, apiPut } from "./services/api.js"
import { clearSession, setSelectedPath } from "./services/session.js"

let progress = { watched: {}, completed: [] }
let stats = {
  totalVideos: PATHS.reduce((sum, item) => sum + item.videos.length, 0),
  watchedVideos: 0,
  remainingVideos: PATHS.reduce((sum, item) => sum + item.videos.length, 0),
  completedPaths: 0,
  totalPaths: PATHS.length
}
let gamification = {
  totalXp: 0,
  currentStreak: 0,
  longestStreak: 0,
  rank: 1,
  badges: [],
  leaderboard: []
}

let plannerWeekStart = mondayYmd(new Date())
let plannerTasks = []
let plannerSummary = {
  totalPlanned: 0,
  completedSessions: 0,
  skippedSessions: 0,
  missedSessions: 0
}
let plannerReminders = []

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

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

function renderGamification(){
  const statsEl = document.getElementById("gamification-stats")
  statsEl.innerHTML = `
    <article class="stat-card">
      <p>Total XP</p>
      <h3>${gamification.totalXp}</h3>
    </article>
    <article class="stat-card">
      <p>Current Streak</p>
      <h3>${gamification.currentStreak} days</h3>
    </article>
    <article class="stat-card">
      <p>Longest Streak</p>
      <h3>${gamification.longestStreak} days</h3>
    </article>
    <article class="stat-card">
      <p>Your Rank</p>
      <h3>#${gamification.rank}</h3>
    </article>
  `

  const badgeEl = document.getElementById("badge-list")
  const badges = Array.isArray(gamification.badges) ? gamification.badges : []
  badgeEl.innerHTML = badges.length > 0
    ? badges.map(badge => `
      <article class="badge-chip">
        <h4>${badge.label}</h4>
        <p>${badge.description}</p>
      </article>
    `).join("")
    : `<p class="meta">No badges unlocked yet. Watch videos to start earning.</p>`

  const leaderboardEl = document.getElementById("leaderboard-list")
  const rows = Array.isArray(gamification.leaderboard) ? gamification.leaderboard : []
  leaderboardEl.innerHTML = rows.length > 0
    ? rows.map(item => `
      <article class="leaderboard-row">
        <p>#${item.rank} ${item.name}</p>
        <p class="meta">${item.totalXp} XP | ${item.currentStreak} day streak</p>
      </article>
    `).join("")
    : `<p class="meta">Leaderboard will appear once users earn XP.</p>`
}

function mondayYmd(date){
  const base = new Date(date)
  const day = base.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  base.setDate(base.getDate() + diffToMonday)
  const y = base.getFullYear()
  const m = `${base.getMonth() + 1}`.padStart(2, "0")
  const d = `${base.getDate()}`.padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addDaysYmd(ymd, days){
  const [year, month, day] = ymd.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, "0")
  const d = `${date.getDate()}`.padStart(2, "0")
  return `${y}-${m}-${d}`
}

function prettyDate(ymd){
  const [year, month, day] = ymd.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function taskDateYmd(task){
  const d = new Date(task.plannedStart)
  if(Number.isNaN(d.getTime())){
    return ""
  }
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, "0")
  const day = `${d.getDate()}`.padStart(2, "0")
  return `${y}-${m}-${day}`
}

function taskTimeLabel(task){
  const d = new Date(task.plannedStart)
  if(Number.isNaN(d.getTime())){
    return "--:--"
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function toInputDateTime(value){
  const d = new Date(value)
  if(Number.isNaN(d.getTime())){
    return ""
  }
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, "0")
  const day = `${d.getDate()}`.padStart(2, "0")
  const h = `${d.getHours()}`.padStart(2, "0")
  const min = `${d.getMinutes()}`.padStart(2, "0")
  return `${y}-${m}-${day}T${h}:${min}`
}

function toCalendarDateStamp(value){
  const d = new Date(value)
  if(Number.isNaN(d.getTime())){
    return ""
  }
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
}

function googleCalendarLink(task){
  const start = new Date(task.plannedStart)
  const end = new Date(start.getTime() + task.durationMin * 60000)
  const text = encodeURIComponent(`${task.courseName}: ${task.topic}`)
  const details = encodeURIComponent(`Priority: ${task.priority} | Status: ${task.status}`)
  const dates = `${toCalendarDateStamp(start)}/${toCalendarDateStamp(end)}`
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&dates=${dates}`
}

function outlookCalendarLink(task){
  const start = new Date(task.plannedStart)
  const end = new Date(start.getTime() + task.durationMin * 60000)
  const subject = encodeURIComponent(`${task.courseName}: ${task.topic}`)
  const body = encodeURIComponent(`Priority: ${task.priority} | Status: ${task.status}`)
  const startIso = encodeURIComponent(start.toISOString())
  const endIso = encodeURIComponent(end.toISOString())
  return `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&subject=${subject}&body=${body}&startdt=${startIso}&enddt=${endIso}`
}

function renderPlannerSummary(){
  const el = document.getElementById("planner-summary")
  el.innerHTML = `
    <article class="stat-card"><p>Total Planned Sessions</p><h3>${plannerSummary.totalPlanned}</h3></article>
    <article class="stat-card"><p>Completed Sessions</p><h3>${plannerSummary.completedSessions}</h3></article>
    <article class="stat-card"><p>Missed Sessions</p><h3>${plannerSummary.missedSessions}</h3></article>
    <article class="stat-card"><p>Skipped Sessions</p><h3>${plannerSummary.skippedSessions}</h3></article>
  `
}

function renderPlannerReminders(){
  const el = document.getElementById("planner-reminders")
  if(plannerReminders.length === 0){
    el.innerHTML = `<p class="meta">No upcoming reminders right now.</p>`
    return
  }
  el.innerHTML = plannerReminders.slice(0, 5).map(task => `
    <article class="planner-note">
      <strong>Upcoming:</strong> ${task.courseName} - ${task.topic} at ${taskTimeLabel(task)}
      <span class="meta"> (remind ${task.reminderMinutes} min before)</span>
    </article>
  `).join("")
}

function plannerTaskMarkup(task){
  return `
    <article class="planner-task" data-task-id="${task.id}">
      <h4>${task.courseName}</h4>
      <p>${task.topic}</p>
      <p class="planner-task-meta">${taskTimeLabel(task)} | ${task.durationMin} mins | ${task.priority}</p>
      <p class="planner-status ${task.status}">${task.status}</p>
      <div class="planner-task-actions">
        <select class="planner-status-select" data-task-id="${task.id}">
          <option value="pending" ${task.status === "pending" ? "selected" : ""}>Pending</option>
          <option value="completed" ${task.status === "completed" ? "selected" : ""}>Completed</option>
          <option value="skipped" ${task.status === "skipped" ? "selected" : ""}>Skipped</option>
        </select>
        <button type="button" class="button-secondary planner-edit-btn" data-task-id="${task.id}">Edit</button>
        <button type="button" class="button-secondary planner-delete-btn" data-task-id="${task.id}">Delete</button>
        <button type="button" class="button-secondary planner-google-btn" data-task-id="${task.id}">Google</button>
        <button type="button" class="button-secondary planner-outlook-btn" data-task-id="${task.id}">Outlook</button>
      </div>
    </article>
  `
}

function renderPlannerCalendar(){
  const weekLabel = document.getElementById("planner-week-label")
  const weekEnd = addDaysYmd(plannerWeekStart, 6)
  weekLabel.textContent = `Week: ${prettyDate(plannerWeekStart)} - ${prettyDate(weekEnd)}`

  const calendar = document.getElementById("planner-calendar")
  const days = weekdays.map((label, index) => {
    const ymd = addDaysYmd(plannerWeekStart, index)
    const tasks = plannerTasks.filter(task => taskDateYmd(task) === ymd)
    return `
      <article class="planner-day" data-day="${ymd}">
        <h4>${label} (${prettyDate(ymd)})</h4>
        ${tasks.length > 0 ? tasks.map(plannerTaskMarkup).join("") : `<p class="meta">No sessions planned.</p>`}
      </article>
    `
  })
  calendar.innerHTML = days.join("")

  calendar.querySelectorAll(".planner-edit-btn").forEach(btn => {
    btn.addEventListener("click", () => openPlannerModal(Number(btn.dataset.taskId)))
  })
  calendar.querySelectorAll(".planner-delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const taskId = Number(btn.dataset.taskId)
      await deletePlannerTask(taskId)
    })
  })
  calendar.querySelectorAll(".planner-status-select").forEach(select => {
    select.addEventListener("change", async () => {
      const taskId = Number(select.dataset.taskId)
      await updateTaskStatus(taskId, select.value)
    })
  })
  calendar.querySelectorAll(".planner-google-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const task = plannerTasks.find(item => item.id === Number(btn.dataset.taskId))
      if(task){
        window.open(googleCalendarLink(task), "_blank", "noopener")
      }
    })
  })
  calendar.querySelectorAll(".planner-outlook-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const task = plannerTasks.find(item => item.id === Number(btn.dataset.taskId))
      if(task){
        window.open(outlookCalendarLink(task), "_blank", "noopener")
      }
    })
  })
}

async function loadPlanner(){
  const [tasksData, summaryData, remindersData] = await Promise.all([
    apiGet(`/study-planner/tasks?weekStart=${plannerWeekStart}`),
    apiGet(`/study-planner/summary?weekStart=${plannerWeekStart}`),
    apiGet("/study-planner/reminders?horizonMinutes=60")
  ])
  plannerTasks = tasksData.tasks || []
  plannerSummary = summaryData.summary || plannerSummary
  plannerReminders = remindersData.reminders || []
  renderPlannerSummary()
  renderPlannerReminders()
  renderPlannerCalendar()
}

function modalEl(){
  return document.getElementById("planner-modal")
}

function openPlannerModal(taskId = null){
  const form = document.getElementById("planner-form")
  form.reset()
  document.getElementById("planner-task-id").value = ""
  document.getElementById("planner-modal-title").textContent = "Add Study Task"
  document.getElementById("planner-reminder-select").value = "10"
  document.getElementById("planner-custom-reminder-wrap").classList.add("hidden")
  document.getElementById("planner-reminder-custom").value = 10

  if(taskId){
    const task = plannerTasks.find(item => item.id === taskId)
    if(task){
      document.getElementById("planner-modal-title").textContent = "Edit Study Task"
      document.getElementById("planner-task-id").value = `${task.id}`
      document.getElementById("planner-course").value = task.courseName
      document.getElementById("planner-topic").value = task.topic
      document.getElementById("planner-start").value = toInputDateTime(task.plannedStart)
      document.getElementById("planner-duration").value = task.durationMin
      document.getElementById("planner-priority").value = task.priority
      document.getElementById("planner-status").value = task.status
      if(task.reminderMinutes === 10 || task.reminderMinutes === 30){
        document.getElementById("planner-reminder-select").value = `${task.reminderMinutes}`
      }else{
        document.getElementById("planner-reminder-select").value = "custom"
        document.getElementById("planner-custom-reminder-wrap").classList.remove("hidden")
        document.getElementById("planner-reminder-custom").value = task.reminderMinutes
      }
    }
  }
  modalEl().classList.remove("hidden")
}

function closePlannerModal(){
  modalEl().classList.add("hidden")
}

async function deletePlannerTask(taskId){
  if(!Number.isFinite(taskId) || taskId <= 0){
    return
  }
  await apiDelete(`/study-planner/tasks/${taskId}`)
  await loadPlanner()
}

async function updateTaskStatus(taskId, status){
  const task = plannerTasks.find(item => item.id === taskId)
  if(!task){
    return
  }
  await apiPut(`/study-planner/tasks/${taskId}`, { status })
  await loadPlanner()
}

async function savePlannerTask(event){
  event.preventDefault()
  const taskId = Number(document.getElementById("planner-task-id").value)
  const reminderSelect = document.getElementById("planner-reminder-select").value
  const reminderMinutes = reminderSelect === "custom"
    ? Number(document.getElementById("planner-reminder-custom").value)
    : Number(reminderSelect)

  const payload = {
    courseName: document.getElementById("planner-course").value.trim(),
    topic: document.getElementById("planner-topic").value.trim(),
    plannedStart: document.getElementById("planner-start").value,
    durationMin: Number(document.getElementById("planner-duration").value),
    priority: document.getElementById("planner-priority").value,
    status: document.getElementById("planner-status").value,
    reminderMinutes
  }

  if(taskId > 0){
    await apiPut(`/study-planner/tasks/${taskId}`, payload)
  }else{
    await apiPost("/study-planner/tasks", payload)
  }

  closePlannerModal()
  await loadPlanner()
}

function syncWeekToGoogle(){
  plannerTasks.forEach((task, index) => {
    setTimeout(() => {
      window.open(googleCalendarLink(task), "_blank", "noopener")
    }, index * 250)
  })
}

function syncWeekToOutlook(){
  plannerTasks.forEach((task, index) => {
    setTimeout(() => {
      window.open(outlookCalendarLink(task), "_blank", "noopener")
    }, index * 250)
  })
}

function bindPlannerEvents(){
  document.getElementById("planner-add-task").addEventListener("click", () => openPlannerModal())
  document.getElementById("planner-close-modal").addEventListener("click", closePlannerModal)
  document.getElementById("planner-form").addEventListener("submit", savePlannerTask)
  document.getElementById("planner-prev-week").addEventListener("click", async () => {
    plannerWeekStart = addDaysYmd(plannerWeekStart, -7)
    await loadPlanner()
  })
  document.getElementById("planner-next-week").addEventListener("click", async () => {
    plannerWeekStart = addDaysYmd(plannerWeekStart, 7)
    await loadPlanner()
  })
  document.getElementById("planner-sync-google").addEventListener("click", syncWeekToGoogle)
  document.getElementById("planner-sync-outlook").addEventListener("click", syncWeekToOutlook)

  document.getElementById("planner-reminder-select").addEventListener("change", event => {
    const customWrap = document.getElementById("planner-custom-reminder-wrap")
    if(event.target.value === "custom"){
      customWrap.classList.remove("hidden")
    }else{
      customWrap.classList.add("hidden")
    }
  })

  modalEl().addEventListener("click", event => {
    if(event.target === modalEl()){
      closePlannerModal()
    }
  })
}

function bindLogout(){
  const logoutBtn = document.getElementById("logout-btn")
  if(!logoutBtn){
    return
  }
  logoutBtn.addEventListener("click", () => {
    clearSession()
    window.location.href = "login.html"
  })
}

async function init(){
  try{
    const data = await apiGet("/progress")
    progress = data.progress || progress
    stats = data.stats || stats
  }catch(_error){
    // Keep UI usable even when progress is unavailable.
  }

  try{
    const data = await apiGet("/gamification/summary")
    gamification = {
      ...(data.summary || gamification),
      leaderboard: data.leaderboard || []
    }
  }catch(_error){
    // Keep dashboard usable even when gamification endpoint fails.
  }

  document.getElementById("path-search").addEventListener("input", renderCards)
  document.getElementById("level-filter").addEventListener("change", renderCards)

  renderStats()
  renderGamification()
  renderCards()
  bindPlannerEvents()
  bindLogout()

  try{
    await loadPlanner()
  }catch(error){
    const reminderEl = document.getElementById("planner-reminders")
    reminderEl.innerHTML = `<p class="status error">Study planner unavailable: ${error.message}</p>`
  }
}

init()
