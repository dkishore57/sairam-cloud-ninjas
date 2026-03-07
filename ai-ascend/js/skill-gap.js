import { apiPost } from "./services/api.js"
import { setSelectedPath } from "./services/session.js"

function setStatus(text, isError = false){
  const el = document.getElementById("skill-gap-status")
  el.textContent = text
  el.className = isError ? "status error" : "status success"
}

function setBusy(busy){
  const button = document.getElementById("analyze-gap-btn")
  button.disabled = busy
  button.textContent = busy ? "Analyzing..." : button.dataset.label
}

function escapeHtml(value){
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}

function render(result){
  document.getElementById("skill-gap-summary").textContent = result.analysis?.summary || "Analysis complete."
  document.getElementById("analysis-method").textContent = `Analysis method: ${result.analysisMethod || "llm"}`
  document.getElementById("next-30-days").textContent = result.analysis?.next30Days || ""

  const missing = Array.isArray(result.missingSkills) ? result.missingSkills : []
  const missingEl = document.getElementById("missing-skills")
  if(missing.length === 0){
    missingEl.innerHTML = `<p class="section-subtitle">No major skill gaps detected.</p>`
  }else{
    missingEl.innerHTML = missing.map(skill => `<span class="skill-chip">${escapeHtml(skill)}</span>`).join("")
  }

  const paths = Array.isArray(result.recommendedLearningPaths) ? result.recommendedLearningPaths : []
  const pathEl = document.getElementById("recommended-paths")
  if(paths.length === 0){
    pathEl.innerHTML = `<p class="section-subtitle">No path recommendations generated.</p>`
    return
  }

  pathEl.innerHTML = paths.map(item => `
    <article class="timeline-card">
      <h4>${escapeHtml(item.title || "Learning Path")}</h4>
      <p class="section-subtitle">${escapeHtml(item.reason || "")}</p>
      ${item.pathId ? `<button class="open-path-btn" data-path-id="${escapeHtml(item.pathId)}">Open Path</button>` : ""}
    </article>
  `).join("")

  pathEl.querySelectorAll(".open-path-btn").forEach(button => {
    button.addEventListener("click", () => {
      setSelectedPath(button.dataset.pathId)
      window.location.href = "learn.html"
    })
  })
}

async function analyze(){
  const targetRole = document.getElementById("target-role").value.trim()
  const resumeText = document.getElementById("resume-text").value.trim()
  const linkedinSkills = document.getElementById("linkedin-skills").value.trim()
  const jobDescriptions = document.getElementById("job-descriptions").value.trim()

  if(!resumeText && !jobDescriptions){
    setStatus("Add resume text or job description.", true)
    return
  }

  try{
    setBusy(true)
    setStatus("")
    const data = await apiPost("/skill-gap-analyzer", {
      targetRole,
      resumeText,
      linkedinSkills,
      jobDescriptions
    })
    render(data.result || {})
    setStatus("Analysis complete.")
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

document.getElementById("analyze-gap-btn").addEventListener("click", analyze)

document.getElementById("resume-file").addEventListener("change", async event => {
  const file = event.target.files?.[0]
  if(!file){
    return
  }
  const text = await file.text().catch(() => "")
  if(text){
    document.getElementById("resume-text").value = text
    setStatus("Resume file loaded.")
  }else{
    setStatus("Unable to read file. Paste resume text manually.", true)
  }
})
