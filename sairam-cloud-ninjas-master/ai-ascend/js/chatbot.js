import { apiPost } from "./services/api.js"
import { getSelectedPath } from "./services/session.js"

const history = []
let activePathId = null

function currentPathId(){
  return getSelectedPath() || "default"
}

function loadPathHistory(){
  history.length = 0
  activePathId = currentPathId()
}

function savePathHistory(){
  // No-op: mentor chat is intentionally non-persistent and single-turn.
}

function syncActivePath(){
  const nextPathId = currentPathId()
  if(activePathId === null){
    loadPathHistory()
    return
  }
  if(nextPathId === activePathId){
    return
  }
  history.length = 0
  activePathId = nextPathId
}

function renderMessages(){
  const list = document.getElementById("chat-messages")
  if(history.length === 0){
    list.innerHTML = `<p class="section-subtitle">No messages yet. Ask your first doubt.</p>`
    return
  }

  list.innerHTML = history.map(item => `
    <div class="chat-item ${item.role === "user" ? "chat-user" : "chat-bot"}">
      <p>${item.text}</p>
    </div>
  `).join("")
}

async function askAI(){
  syncActivePath()
  const input = document.getElementById("question")
  const button = document.getElementById("ask-btn")
  const question = input.value.trim()

  if(!question){
    return
  }

  history.length = 0
  history.push({ role: "user", text: question })
  renderMessages()
  input.value = ""
  button.disabled = true
  button.textContent = "Thinking..."

  try{
    const data = await apiPost("/chat", {
      question,
      pathId: activePathId
    })
    history.length = 0
    if(data.answer){
      history.push({ role: "user", text: question })
      history.push({ role: "assistant", text: data.answer })
    }
  }catch(error){
    if(error.code === "quota_exceeded"){
      const retryText = error.retryAfterSec ? ` Try again in ${error.retryAfterSec}s.` : ""
      history.length = 0
      history.push({ role: "user", text: question })
      history.push({
        role: "assistant",
        text: `AI quota is exceeded for this API key.${retryText} You can also enable billing or use another key.`
      })
    }else{
      history.length = 0
      history.push({ role: "user", text: question })
      history.push({ role: "assistant", text: `Error: ${error.message}` })
    }
  }finally{
    button.disabled = false
    button.textContent = "Ask"
    renderMessages()
  }
}

window.askAI = askAI

async function init(){
  loadPathHistory()
  renderMessages()
  window.addEventListener("focus", () => {
    syncActivePath()
    renderMessages()
  })
}

init()
