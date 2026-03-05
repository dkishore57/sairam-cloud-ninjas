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
  }
}

guardRoute()
