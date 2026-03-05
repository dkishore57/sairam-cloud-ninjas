import { PATHS_BY_ID } from "../data/paths.js"
import { apiGet, apiPost } from "./services/api.js"
import { getSelectedPath } from "./services/session.js"

const container = document.getElementById("videos")
const pathId = getSelectedPath() || "frontend"
const path = PATHS_BY_ID[pathId]
let progress = { watched: {}, completed: [] }

function isWatched(videoId){
  return (progress.watched[path.id] || []).includes(videoId)
}

function render(){
  document.getElementById("learn-title").textContent = path.title
  document.getElementById("learn-description").textContent = path.description

  if(path.videos.length === 0){
    container.innerHTML = "<p>No videos found for this path.</p>"
    return
  }

  const done = progress.completed.includes(path.id)
  container.innerHTML = path.videos.map(video => `
    <article class="video-card">
      ${video.url
        ? `<iframe
            src="${video.url}"
            class="video-frame"
            loading="lazy"
            allowfullscreen
            title="${video.title}"></iframe>`
        : `<div class="video-placeholder">Video link pending</div>`
      }
      <div class="video-meta">
        <div>
          <h4>${video.title}</h4>
          <p class="meta">${video.subdomain || "General"}</p>
        </div>
        <p>${video.durationMin} min</p>
      </div>
      <button class="video-watch-btn" data-video-id="${video.id}" ${isWatched(video.id) ? "disabled" : ""}>
        ${isWatched(video.id) ? "Watched" : "Mark as Watched"}
      </button>
    </article>
  `).join("")

  const watchedCount = (progress.watched[path.id] || []).length
  const total = path.videos.length
  const completionEl = document.getElementById("path-progress")
  completionEl.textContent = done ? "Path completed" : `Progress: ${watchedCount}/${total} videos`

  const completeBtn = document.getElementById("complete-path-btn")
  completeBtn.disabled = done || watchedCount < total
  completeBtn.textContent = done ? "Completed" : "Complete Path"

  container.querySelectorAll(".video-watch-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      try{
        await apiPost("/progress/watch", { pathId: path.id, videoId: btn.dataset.videoId })
        const data = await apiGet("/progress")
        progress = data.progress
        render()
      }catch(error){
        alert(error.message)
      }
    })
  })
}

async function init(){
  if(!path){
    container.innerHTML = "<p class='status error'>Invalid path selected.</p>"
    return
  }

  try{
    const data = await apiGet("/progress")
    progress = data.progress || progress
  }catch(_error){
    // Keep learning page functional even if progress load fails.
  }

  document.getElementById("complete-path-btn").addEventListener("click", async () => {
    try{
      await apiPost("/progress/complete", { pathId: path.id })
      const data = await apiGet("/progress")
      progress = data.progress
      render()
    }catch(error){
      alert(error.message)
    }
  })

  render()
}

init()
