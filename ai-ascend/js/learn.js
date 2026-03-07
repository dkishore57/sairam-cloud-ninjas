import { PATHS_BY_ID } from "../data/paths.js"
import { apiGet, apiPost } from "./services/api.js"
import { getSelectedPath } from "./services/session.js"

const container = document.getElementById("videos")
const flashcardRoot = document.getElementById("flashcard-root")
const pathId = getSelectedPath() || "frontend"
const path = PATHS_BY_ID[pathId]
let progress = { watched: {}, completed: [] }
let flashcards = []
let flashcardIndex = 0
let flashcardFlipped = false

function isWatched(videoId){
  return (progress.watched[path.id] || []).includes(videoId)
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}

function setFlashcardStatus(text, isError = false){
  const status = document.getElementById("flashcard-status")
  status.textContent = text
  status.className = isError ? "status error" : "status success"
}

function renderFlashcards(){
  if(!flashcardRoot){
    return
  }
  if(flashcards.length === 0){
    flashcardRoot.innerHTML = `<p class="section-subtitle">Generate flashcards to revise this path.</p>`
    return
  }

  const current = flashcards[flashcardIndex] || {}
  flashcardRoot.innerHTML = `
    <section class="flashcard-stage">
      <p class="flashcard-progress">Card ${flashcardIndex + 1}/${flashcards.length}</p>
      <div class="flashcard-viewport">
        <article class="flashcard-3d ${flashcardFlipped ? "is-flipped" : ""}" id="flashcard-card" role="button" tabindex="0" aria-label="Flip flashcard">
          <div class="flashcard-face flashcard-front">
            <div>
              <p class="flashcard-label">Question</p>
              <p class="flashcard-question">${escapeHtml(current.question)}</p>
            </div>
            <p class="flashcard-hint">Hint: ${escapeHtml(current.hint)}</p>
          </div>
          <div class="flashcard-face flashcard-back">
            <div>
              <p class="flashcard-label">Answer</p>
              <p class="flashcard-answer">${escapeHtml(current.answer)}</p>
            </div>
            <p class="flashcard-hint">Click card to flip back</p>
          </div>
        </article>
      </div>
      <div class="flashcard-nav">
        <button id="flashcard-prev-btn" type="button" class="button-secondary">Previous</button>
        <button id="flashcard-next-btn" type="button">Next</button>
      </div>
    </section>
  `

  const card = document.getElementById("flashcard-card")
  card.addEventListener("click", () => {
    flashcardFlipped = !flashcardFlipped
    renderFlashcards()
  })
  card.addEventListener("keydown", event => {
    if(event.key === "Enter" || event.key === " "){
      event.preventDefault()
      flashcardFlipped = !flashcardFlipped
      renderFlashcards()
    }
  })
  document.getElementById("flashcard-prev-btn").addEventListener("click", () => {
    flashcardIndex = (flashcardIndex - 1 + flashcards.length) % flashcards.length
    flashcardFlipped = false
    renderFlashcards()
  })
  document.getElementById("flashcard-next-btn").addEventListener("click", () => {
    flashcardIndex = (flashcardIndex + 1) % flashcards.length
    flashcardFlipped = false
    renderFlashcards()
  })
}

async function generateFlashcards(focusTitles = null, triggerButton = null){
  const button = triggerButton || document.getElementById("generate-flashcards-btn")
  const originalLabel = button ? button.textContent : "Generate Flashcards"
  if(button){
    button.disabled = true
    button.textContent = "Generating..."
  }
  setFlashcardStatus("")

  try{
    const watchedIds = progress.watched[path.id] || []
    const defaultTitles = path.videos
      .filter(video => watchedIds.includes(video.id))
      .map(video => video.title)
      .slice(0, 10)
    const watchedTitles = Array.isArray(focusTitles) && focusTitles.length > 0
      ? focusTitles
      : defaultTitles
    const data = await apiPost("/flashcards", {
      pathId: path.id,
      watchedTitles
    })
    flashcards = Array.isArray(data.cards) ? data.cards : []
    flashcardIndex = 0
    flashcardFlipped = false
    renderFlashcards()
    setFlashcardStatus(flashcards.length > 0 ? "Flashcards generated." : "No flashcards generated.", flashcards.length === 0)
  }catch(error){
    if(error.code === "quota_exceeded"){
      const retryText = error.retryAfterSec ? ` Try again in ${error.retryAfterSec}s.` : ""
      setFlashcardStatus(`AI quota is exceeded.${retryText}`, true)
    }else{
      setFlashcardStatus(error.message, true)
    }
  }finally{
    if(button){
      button.disabled = false
      button.textContent = originalLabel
    }
  }
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
        ? `<a class="yt-link" href="${video.url}" target="_blank" rel="noopener noreferrer">Click to watch</a>`
        : `<div class="video-placeholder">YouTube link pending</div>`
      }
      <div class="video-meta">
        <div>
          <h4>${video.title}</h4>
          <p class="meta">${video.subdomain || "General"}</p>
        </div>
      </div>
      <div class="video-actions">
        <button class="video-watch-btn" data-video-id="${video.id}">
          ${isWatched(video.id) ? "Mark as Unwatched" : "Mark as Watched"}
        </button>
        <button class="video-flashcards-btn button-secondary" data-video-id="${video.id}">
          Generate Flashcards
        </button>
      </div>
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
        const videoId = btn.dataset.videoId
        const endpoint = isWatched(videoId) ? "/progress/unwatch" : "/progress/watch"
        const data = await apiPost(endpoint, { pathId: path.id, videoId })
        progress = data.progress || progress
        render()
      }catch(error){
        alert(error.message)
      }
    })
  })

  container.querySelectorAll(".video-flashcards-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const videoId = btn.dataset.videoId
      const selectedVideo = path.videos.find(video => video.id === videoId)
      if(!selectedVideo){
        setFlashcardStatus("Unable to find this video for flashcard generation.", true)
        return
      }
      await generateFlashcards([selectedVideo.title], btn)
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
  document.getElementById("generate-flashcards-btn").addEventListener("click", generateFlashcards)

  render()
  renderFlashcards()
}

init()
