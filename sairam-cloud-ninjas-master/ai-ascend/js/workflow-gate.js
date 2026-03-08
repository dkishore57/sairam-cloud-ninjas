const TOKEN_KEY = "ai_ascend_token"

function getToken(){
  return localStorage.getItem(TOKEN_KEY)
}

function clearSession(){
  localStorage.removeItem("ai_ascend_token")
  localStorage.removeItem("ai_ascend_user")
}

async function hasValidSession(){
  const token = getToken()
  if(!token){
    return false
  }

  try{
    const response = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if(!response.ok){
      clearSession()
      return false
    }

    return true
  }catch(_error){
    // If backend is down, keep local session behavior.
    return true
  }
}

function promptAuth(){
  const goToSignin = window.confirm(
    "You need to sign in to open this step.\n\nPress OK for Sign In.\nPress Cancel for Sign Up."
  )
  window.location.href = goToSignin ? "login.html" : "signup.html"
}

async function onProtectedLinkClick(event){
  event.preventDefault()
  const link = event.currentTarget
  const destination = link.getAttribute("href")
  if(!destination){
    return
  }

  const validSession = await hasValidSession()
  if(validSession){
    window.location.href = destination
    return
  }

  promptAuth()
}

function initWorkflowGate(){
  const links = document.querySelectorAll(".protected-step-link")
  links.forEach(link => {
    link.addEventListener("click", onProtectedLinkClick)
  })
}

initWorkflowGate()
