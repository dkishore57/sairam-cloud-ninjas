import { apiPost } from "./services/api.js"
import { setSession } from "./services/session.js"

function setStatus(text, isError = false){
  const status = document.getElementById("form-status")
  if(!status){
    if(text){
      alert(text)
    }
    return
  }
  status.textContent = text
  status.className = isError ? "status error" : "status success"
}

function setBusy(buttonId, busy){
  const button = document.getElementById(buttonId)
  if(button){
    button.disabled = busy
    button.textContent = busy ? "Please wait..." : button.dataset.label
  }
}

async function signup(){
  const name = document.getElementById("name").value.trim()
  const email = document.getElementById("email").value.trim()
  const password = document.getElementById("password").value

  if(!name || !email || password.length < 6){
    setStatus("Enter valid name, email, and password (min 6 chars).", true)
    return
  }

  try{
    setBusy("signup-btn", true)
    setStatus("")
    await apiPost("/auth/signup", { name, email, password })
    setStatus("Account created. Redirecting to login...")
    setTimeout(() => { window.location.href = "login.html" }, 800)
  }catch(error){
    setStatus(error.message, true)
  }finally{
    setBusy("signup-btn", false)
  }
}

async function login(){
  const email = document.getElementById("email").value.trim()
  const password = document.getElementById("password").value

  if(!email || !password){
    setStatus("Email and password are required.", true)
    return
  }

  try{
    setBusy("login-btn", true)
    setStatus("")
    const data = await apiPost("/auth/login", { email, password })
    setSession(data.token, data.user)
    setStatus("Login successful. Redirecting...")
    setTimeout(() => { window.location.href = "dashboard.html" }, 500)
  }catch(error){
    setStatus(error.message, true)
  }finally{
    setBusy("login-btn", false)
  }
}

window.signup = signup
window.login = login
