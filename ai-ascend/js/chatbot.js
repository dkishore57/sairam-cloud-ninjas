import { apiGet, apiPost } from "./services/api.js"
import { getSelectedPath } from "./services/session.js"

const history = []
const pathId = getSelectedPath() || "frontend"

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
  const input = document.getElementById("question")
  const button = document.getElementById("ask-btn")
  const question = input.value.trim()

  if(!question){
    return
  }

  history.push({ role: "user", text: question })
  renderMessages()
  input.value = ""
  button.disabled = true
  button.textContent = "Thinking..."

  try{
    const data = await apiPost("/chat", { question, pathId })
    history.length = 0
    history.push(...(data.history || []))
  }catch(error){
    if(error.code === "quota_exceeded"){
      const retryText = error.retryAfterSec ? ` Try again in ${error.retryAfterSec}s.` : ""
      history.push({
        role: "assistant",
        text: `AI quota is exceeded for this API key.${retryText} You can also enable billing or use another key.`
      })
    }else{
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
  try{
    const data = await apiGet(`/chat/history?pathId=${encodeURIComponent(pathId)}`)
    history.push(...(data.history || []))
  }catch(_error){
    // If history fetch fails, chat still works for current session.
  }
  renderMessages()
}

init()
