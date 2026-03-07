import { apiPost } from "./services/api.js"
import { clearSession } from "./services/session.js"

async function logout(){
  try{
    await apiPost("/auth/logout", {})
  }catch(_error){
    // Even if API fails, clear client session.
  }finally{
    clearSession()
    window.location.href = "login.html"
  }
}

document.querySelectorAll(".logout-btn").forEach(btn => {
  btn.addEventListener("click", logout)
})
