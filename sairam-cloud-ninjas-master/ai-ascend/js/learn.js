import { PATHS_BY_ID } from "../data/paths.js"
import { apiGet, apiPost } from "./services/api.js"
import { getSelectedPath } from "./services/session.js"

const container = document.getElementById("videos")
const quizStatusEl = document.getElementById("quiz-status")
const quizOutputEl = document.getElementById("quiz-output")
const predictionTextEl = document.getElementById("prediction-text")
const predictionHintEl = document.getElementById("prediction-hint")
const pathId = getSelectedPath() || "frontend"
const path = PATHS_BY_ID[pathId]
let progress = { watched: {}, completed: [] }
let gamification = { totalXp: 0, currentStreak: 0, badges: [] }
let activeQuizVideoId = ""
let currentFlashcardIndex = 0
let isFlashcardFlipped = false
let lastRenderedQuiz = null
let lastRenderedSource = "ai"

function isWatched(videoId){
  return (progress.watched[path.id] || []).includes(videoId)
}

function setQuizStatus(text, isError = false){
  quizStatusEl.textContent = text
  quizStatusEl.className = isError ? "status error" : "status success"
}

function snapshotGamification(){
  return {
    totalXp: Number(gamification.totalXp || 0),
    currentStreak: Number(gamification.currentStreak || 0),
    badgesCount: Array.isArray(gamification.badges) ? gamification.badges.length : 0
  }
}

function isMilestoneReached(before, after, force = false){
  if(force){
    return true
  }
  if(after.badgesCount > before.badgesCount){
    return true
  }
  if(after.currentStreak > before.currentStreak){
    return true
  }
  if(Math.floor(after.totalXp / 100) > Math.floor(before.totalXp / 100)){
    return true
  }
  return false
}

function triggerConfetti(){
  const layer = document.createElement("div")
  layer.className = "confetti-layer"
  const colors = ["#a78bfa", "#818cf8", "#c4b5fd", "#f0abfc", "#e9d5ff", "#ddd6fe"]

  for(let i = 0; i < 160; i += 1){
    const piece = document.createElement("span")
    piece.className = "confetti-piece"
    piece.style.left = `${Math.random() * 100}%`
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
    piece.style.animationDelay = `${Math.random() * 0.35}s`
    piece.style.animationDuration = `${1.9 + Math.random() * 1.2}s`
    piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 220}px`)
    piece.style.opacity = `${0.75 + Math.random() * 0.25}`
    piece.style.transform = `rotate(${Math.random() * 360}deg)`
    layer.appendChild(piece)
  }

  document.body.appendChild(layer)
  setTimeout(() => {
    layer.remove()
  }, 3600)
}

function celebrate(pathCompleted = false){
  const confettiFn = window.confetti
  if(typeof confettiFn === "function"){
    const durationMs = 2000
    const end = Date.now() + durationMs

    ;(function frame(){
      confettiFn({
        particleCount: 7,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      })
      confettiFn({
        particleCount: 7,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      })
      if(Date.now() < end){
        requestAnimationFrame(frame)
      }
    })()

    confettiFn({
      particleCount: pathCompleted ? 200 : 120,
      spread: pathCompleted ? 120 : 95,
      origin: { y: 0.6 }
    })
  }else{
    triggerConfetti()
  }

  if(pathCompleted){
    setTimeout(() => {
      alert("Congratulations! You completed this learning path!")
    }, 300)
  }
}

function renderPrediction(prediction){
  if(!predictionTextEl || !predictionHintEl){
    return
  }
  if(!prediction){
    predictionTextEl.textContent = "Prediction is unavailable right now."
    predictionHintEl.textContent = ""
    return
  }

  if(prediction.completed){
    predictionTextEl.textContent = "Path already completed. Great consistency."
    predictionHintEl.textContent = ""
    return
  }

  predictionTextEl.textContent = `At your current pace, you may complete this path in ${prediction.estimatedDaysToComplete} day(s).`
  if(prediction.paceDropPercent >= 20){
    predictionHintEl.textContent = `Your pace dropped by ${prediction.paceDropPercent}% recently. Suggested schedule: watch ${prediction.suggestedVideosPerDay} video(s)/day.`
  }else{
    predictionHintEl.textContent = `Current pace: ${prediction.currentVideosPerDay}/day. Suggested schedule: ${prediction.suggestedVideosPerDay} video(s)/day to stay on track.`
  }
}

function renderFallbackPredictionFromProgress(){
  if(!predictionTextEl || !predictionHintEl || !path){
    return
  }
  const watchedCount = (progress.watched[path.id] || []).length
  const total = path.videos.length
  const remaining = Math.max(0, total - watchedCount)

  if(remaining === 0){
    predictionTextEl.textContent = "Path already completed. Great consistency."
    predictionHintEl.textContent = ""
    return
  }

  const estimatedDays = watchedCount > 0 ? remaining : total
  const suggestedPerDay = watchedCount > 0 ? Math.max(1, Math.ceil(remaining / 7)) : 1
  predictionTextEl.textContent = `At your current pace, you may complete this path in ${estimatedDays} day(s).`
  predictionHintEl.textContent = `Suggested schedule: watch ${suggestedPerDay} video(s)/day.`
}

function buildLocalTopicQuiz(video){
  const title = video?.title || "Selected Topic"
  const domain = path?.title || "Learning Path"
  const hintBase = "Think of purpose, workflow, and one practical use case."
  const flashcards = [
    {
      prompt: `What is ${title} in simple words?`,
      answer: `${title} is an important concept in ${domain} used to build reliable real-world solutions.`,
      hint: hintBase
    },
    {
      prompt: `Why does ${title} matter in ${domain}?`,
      answer: `It improves implementation quality, clarity, and long-term maintainability of projects.`,
      hint: "Answer with impact on real projects."
    },
    {
      prompt: `What is one common mistake while learning ${title}?`,
      answer: "Skipping fundamentals and using tools without understanding the underlying concept.",
      hint: "Think of beginner mistakes."
    },
    {
      prompt: `Give one practical use-case of ${title}.`,
      answer: "Apply it in a small project with clear steps, measurable output, and review checkpoints.",
      hint: "Use a scenario from your current path."
    },
    {
      prompt: `What should you learn next after ${title}?`,
      answer: "Move to adjacent concepts and integrate them through hands-on mini projects.",
      hint: "Think progression, not isolated learning."
    }
  ]

  const quizItems = [
    {
      question: `Which statement best describes ${title}?`,
      options: [
        `${title} is best learned through practical implementation.`,
        `${title} has no practical value in projects.`,
        `${title} should only be memorized without application.`,
        `${title} is unrelated to ${domain}.`
      ],
      correctIndex: 0,
      explanation: "Practical usage builds retention and problem-solving ability."
    }
  ]

  return {
    id: `local-${video?.id || "topic"}`,
    pathId: path?.id || "",
    videoId: video?.id || "",
    videoTitle: title,
    title: `${title} Flashcards`,
    summary: `Generated from local topic context for ${domain}.`,
    flashcards,
    quizItems
  }
}

async function loadPrediction(){
  try{
    const data = await apiGet(`/progress/prediction?pathId=${encodeURIComponent(path.id)}`)
    renderPrediction(data.prediction || null)
  }catch(_error){
    renderFallbackPredictionFromProgress()
  }
}

function renderQuiz(quiz, source = "ai"){
  lastRenderedQuiz = quiz
  lastRenderedSource = source

  if(!quiz){
    quizOutputEl.innerHTML = `<p class="section-subtitle">No flashcards generated yet for this path.</p>`
    return
  }
  const sourceText = source === "transcript"
    ? "Generated directly from YouTube lesson transcript."
    : source === "topic"
      ? "Generated from course topic context (captions were unavailable)."
    : source === "fallback"
      ? "Generated from fallback quiz builder."
      : `Generated by AI model (${source || "provider"}) from lesson transcript.`
  const flashcards = Array.isArray(quiz.flashcards) ? quiz.flashcards : []
  const quizItems = Array.isArray(quiz.quizItems) ? quiz.quizItems : []
  if(flashcards.length === 0){
    currentFlashcardIndex = 0
    isFlashcardFlipped = false
  }else{
    if(currentFlashcardIndex > flashcards.length - 1){
      currentFlashcardIndex = flashcards.length - 1
    }
    if(currentFlashcardIndex < 0){
      currentFlashcardIndex = 0
    }
  }

  const activeCard = flashcards[currentFlashcardIndex] || {}
  quizOutputEl.innerHTML = `
    <article class="roadmap-phase">
      <p class="eyebrow">Flashcards for ${quiz.videoTitle || "Selected Topic"}</p>
      <h3>${quiz.title || "Study Flashcards"}</h3>
      <p class="section-subtitle">${quiz.summary || ""}</p>
      <p class="meta">${sourceText}</p>
    </article>
    <div class="flashcard-stage">
      ${flashcards.length > 0
        ? `
          <p class="meta flashcard-progress">Flashcard ${currentFlashcardIndex + 1} / ${flashcards.length}</p>
          <div class="flashcard-viewport">
            <div id="interactive-flashcard" class="flashcard-3d ${isFlashcardFlipped ? "is-flipped" : ""}">
              <div class="flashcard-face flashcard-front">
                <p class="flashcard-label">Question</p>
                <h3 class="flashcard-question">${activeCard.prompt || activeCard.question || "Prompt unavailable"}</h3>
                <p class="flashcard-hint"><strong>Hint:</strong> ${activeCard.hint || activeCard.explanation || "No hint available."}</p>
              </div>
              <div class="flashcard-face flashcard-back">
                <p class="flashcard-label">Answer</p>
                <p class="flashcard-answer">${activeCard.answer || "Answer not available."}</p>
              </div>
            </div>
          </div>
          <div class="flashcard-nav">
            <button id="prev-flashcard-btn" type="button" class="button-secondary" ${currentFlashcardIndex === 0 ? "disabled" : ""}>Previous Flashcard</button>
            <button id="next-flashcard-btn" type="button" class="button-secondary" ${currentFlashcardIndex >= flashcards.length - 1 ? "disabled" : ""}>Next Flashcard</button>
          </div>
        `
        : `<p class="meta">No flashcards available.</p>`
      }
    </div>
    <article class="roadmap-phase">
      <h3>Quick Quiz</h3>
      <p class="section-subtitle">Answer these questions to test what you learned.</p>
      <div id="learning-quiz">
        ${quizItems.map((item, qIndex) => `
          <div class="quiz-question" data-correct-index="${item.correctIndex}">
            <p class="meta"><strong>Q${qIndex + 1}.</strong> ${item.question}</p>
            <div class="quiz-options">
              ${(Array.isArray(item.options) ? item.options : []).map((option, oIndex) => `
                <label class="quiz-option">
                  <input type="radio" name="learning-q-${qIndex}" value="${oIndex}">
                  <span>${option}</span>
                </label>
              `).join("")}
            </div>
            <p class="meta quiz-explainer" style="display:none;">${item.explanation || ""}</p>
          </div>
        `).join("")}
      </div>
      ${quizItems.length > 0
        ? '<button id="submit-learning-quiz" type="button">Submit Quiz</button><p id="learning-quiz-score" class="meta"></p>'
        : '<p class="meta">Quiz questions are not available for this video yet.</p>'
      }
    </article>
  `

  const interactiveCard = document.getElementById("interactive-flashcard")
  if(interactiveCard){
    interactiveCard.addEventListener("click", () => {
      isFlashcardFlipped = !isFlashcardFlipped
      interactiveCard.classList.toggle("is-flipped", isFlashcardFlipped)
    })
  }

  const prevBtn = document.getElementById("prev-flashcard-btn")
  if(prevBtn){
    prevBtn.addEventListener("click", () => {
      currentFlashcardIndex = Math.max(0, currentFlashcardIndex - 1)
      isFlashcardFlipped = false
      renderQuiz(lastRenderedQuiz, lastRenderedSource)
    })
  }

  const nextBtn = document.getElementById("next-flashcard-btn")
  if(nextBtn){
    nextBtn.addEventListener("click", () => {
      currentFlashcardIndex += 1
      isFlashcardFlipped = false
      renderQuiz(lastRenderedQuiz, lastRenderedSource)
    })
  }

  const submitBtn = document.getElementById("submit-learning-quiz")
  if(submitBtn){
    submitBtn.addEventListener("click", () => {
      const questionEls = [...quizOutputEl.querySelectorAll(".quiz-question")]
      let correct = 0
      let attempted = 0
      questionEls.forEach((questionEl, index) => {
        const selected = quizOutputEl.querySelector(`input[name="learning-q-${index}"]:checked`)
        const correctIndex = Number(questionEl.dataset.correctIndex || 0)
        const explainer = questionEl.querySelector(".quiz-explainer")
        if(selected){
          attempted += 1
          if(Number(selected.value) === correctIndex){
            correct += 1
          }
        }
        if(explainer){
          explainer.style.display = "block"
        }
      })
      const scoreEl = document.getElementById("learning-quiz-score")
      if(scoreEl){
        scoreEl.textContent = `Score: ${correct}/${questionEls.length} (attempted ${attempted}/${questionEls.length})`
      }
    })
  }
}

async function loadLatestQuiz(videoId){
  try{
    const data = await apiGet(`/ai/quiz/latest?pathId=${encodeURIComponent(path.id)}&videoId=${encodeURIComponent(videoId)}`)
    if(data.quiz){
      renderQuiz(data.quiz, "ai")
    }
  }catch(_error){
    // Non-blocking; quiz can still be generated on demand.
  }
}

async function generateQuiz(videoId){
  const video = path.videos.find(item => item.id === videoId)
  if(!video){
    return
  }
  const button = container.querySelector(`.quiz-generate-btn[data-video-id="${videoId}"]`)
  if(button){
    button.disabled = true
    button.textContent = "Generating..."
  }
  setQuizStatus("")
  try{
    const data = await apiPost("/ai/quiz/generate", {
      pathId: path.id,
      videoId,
      videoTitle: video.title
    })
    activeQuizVideoId = videoId
    currentFlashcardIndex = 0
    isFlashcardFlipped = false
    renderQuiz(data.quiz, data.source)
    setQuizStatus(`Flashcards generated for "${video.title}".`)
  }catch(error){
    if(error.code === "network_error"){
      const localQuiz = buildLocalTopicQuiz(video)
      activeQuizVideoId = videoId
      currentFlashcardIndex = 0
      isFlashcardFlipped = false
      renderQuiz(localQuiz, "topic")
      setQuizStatus(`Server unreachable. Generated local topic flashcards for "${video.title}".`)
      return
    }
    setQuizStatus(error.message, true)
  }finally{
    if(button){
      button.disabled = false
      button.textContent = "Generate Flashcards"
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
        ? `<a class="yt-link" href="${video.url}" target="_blank" rel="noopener noreferrer">Click to watch on YouTube</a>`
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
        <button class="button-secondary quiz-generate-btn" data-video-id="${video.id}">
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
        const before = snapshotGamification()
        const endpoint = isWatched(videoId) ? "/progress/unwatch" : "/progress/watch"
        const data = await apiPost(endpoint, { pathId: path.id, videoId })
        progress = data.progress || progress
        gamification = data.gamification || gamification
        render()
        renderFallbackPredictionFromProgress()
        await loadPrediction()
        const after = snapshotGamification()
        if(isMilestoneReached(before, after, false)){
          celebrate(false)
        }
      }catch(error){
        alert(error.message)
      }
    })
  })

  container.querySelectorAll(".quiz-generate-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const videoId = btn.dataset.videoId
      await generateQuiz(videoId)
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
    gamification = data.gamification || gamification
    renderFallbackPredictionFromProgress()
  }catch(_error){
    // Keep learning page functional even if progress load fails.
  }

  document.getElementById("complete-path-btn").addEventListener("click", async () => {
    try{
      const before = snapshotGamification()
      const data = await apiPost("/progress/complete", { pathId: path.id })
      progress = data.progress || progress
      gamification = data.gamification || gamification
      render()
      renderFallbackPredictionFromProgress()
      await loadPrediction()
      const after = snapshotGamification()
      if(isMilestoneReached(before, after, true)){
        celebrate(true)
      }
    }catch(error){
      alert(error.message)
    }
  })

  render()
  await loadPrediction()
  const initialVideoId = activeQuizVideoId || path.videos[0]?.id
  if(initialVideoId){
    await loadLatestQuiz(initialVideoId)
  }else{
    renderQuiz(null)
  }
}

init()
