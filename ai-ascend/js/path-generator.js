import { apiPost } from "./services/api.js"

function setStatus(text, isError = false){
  const el = document.getElementById("pathgen-status")
  el.textContent = text
  el.className = isError ? "status error" : "status success"
}

function setBusy(busy){
  const button = document.getElementById("generate-path-btn")
  button.disabled = busy
  button.textContent = busy ? "Generating..." : button.dataset.label
}

function escapeHtml(value){
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}

function renderRoadmap(roadmap){
  document.getElementById("roadmap-summary").textContent = roadmap.summary || "Custom roadmap generated."
  document.getElementById("roadmap-estimate").textContent = `Estimated completion: ${roadmap.estimatedCompletion || "N/A"}`
  const timeline = Array.isArray(roadmap.timeline) ? roadmap.timeline : []
  const container = document.getElementById("roadmap-timeline")

  if(timeline.length === 0){
    container.innerHTML = `<p class="section-subtitle">No timeline generated. Try refining your goal.</p>`
    return
  }

  container.innerHTML = timeline.map(item => {
    const resources = (item.resources || []).map(val => `<li>${escapeHtml(val)}</li>`).join("")
    const outcomes = (item.outcomes || []).map(val => `<li>${escapeHtml(val)}</li>`).join("")
    return `
      <article class="timeline-card">
        <h4>${escapeHtml(item.phase)}</h4>
        <p class="meta">${escapeHtml(item.focus)}</p>
        <p class="timeline-title">Resources</p>
        <ul>${resources || "<li>Self-paced learning resources</li>"}</ul>
        <p class="timeline-title">Outcomes</p>
        <ul>${outcomes || "<li>Complete core milestone</li>"}</ul>
      </article>
    `
  }).join("")
}

async function generateRoadmap(){
  const skillLevel = document.getElementById("skill-level").value
  const careerGoal = document.getElementById("career-goal").value.trim()
  const weeklyHours = Number(document.getElementById("weekly-hours").value)
  const learningStyle = document.getElementById("learning-style").value

  if(!careerGoal){
    setStatus("Career goal is required.", true)
    return
  }
  if(Number.isNaN(weeklyHours) || weeklyHours < 1 || weeklyHours > 80){
    setStatus("Weekly hours must be between 1 and 80.", true)
    return
  }

  try{
    setBusy(true)
    setStatus("")
    const data = await apiPost("/path-generator", {
      skillLevel,
      careerGoal,
      weeklyHours,
      learningStyle
    })
    renderRoadmap(data.roadmap || {})
    setStatus("Roadmap generated.")
  }catch(error){
    if(error.code === "quota_exceeded"){
      const retryText = error.retryAfterSec ? ` Try again in ${error.retryAfterSec}s.` : ""
      setStatus(`AI quota is exceeded.${retryText}`, true)
      return
    }
    setStatus(error.message, true)
  }finally{
    setBusy(false)
  }
}

document.getElementById("generate-path-btn").addEventListener("click", generateRoadmap)
