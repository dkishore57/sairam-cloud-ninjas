import { apiGet } from "./services/api.js"
import { isLoggedIn } from "./services/session.js"

async function guardRoute(){
  if(!isLoggedIn()){
    window.location.href = "login.html"
    return
  }

  try{
    await apiGet("/auth/me")
  }catch(_error){
    window.location.href = "login.html"
    return
  }

  const isDashboard = window.location.pathname.endsWith("dashboard.html")
  if(isDashboard){
    try{
      const data = await apiGet("/ai/career-recommend/latest")
      if(!data.recommendation){
        window.location.href = "career-quiz.html"
      }
    }catch(_error){
      // Keep dashboard reachable if recommendation endpoint is temporarily unavailable.
    }
  }
}

guardRoute()
