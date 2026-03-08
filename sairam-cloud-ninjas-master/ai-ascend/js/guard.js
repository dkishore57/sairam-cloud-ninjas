import { apiGet } from "./services/api.js"
import { isLoggedIn } from "./services/session.js"

async function guardRoute(){
  if(!isLoggedIn()){
    window.location.href = "login.html"
    return
  }

  try{
    const authData = await apiGet("/auth/me")
    const user = authData?.user || null
    const isDashboard = window.location.pathname.endsWith("dashboard.html")
    if(isDashboard && user && !user.careerQuizCompleted){
      window.location.href = "career-quiz.html"
      return
    }
  }catch(_error){
    window.location.href = "login.html"
    return
  }
}

guardRoute()
