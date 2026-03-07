const TOKEN_KEY = "career_craft_token"
const USER_KEY = "career_craft_user"
const SELECTED_PATH_KEY = "career_craft_selected_path"

export function setSession(token, user){
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(){
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(SELECTED_PATH_KEY)
}

export function getToken(){
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser(){
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function isLoggedIn(){
  return Boolean(getToken())
}

export function setSelectedPath(pathId){
  localStorage.setItem(SELECTED_PATH_KEY, pathId)
}

export function getSelectedPath(){
  return localStorage.getItem(SELECTED_PATH_KEY)
}
