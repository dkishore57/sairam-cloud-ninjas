import { clearSession, getToken } from "./session.js"

const API_BASE = "/api"

async function request(path, options = {}){
  const token = getToken()
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  }

  if(token){
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  })

  const rawText = await response.text()
  let payload = {}
  try{
    payload = rawText ? JSON.parse(rawText) : {}
  }catch(_error){
    payload = {}
  }

  if(response.status === 401){
    clearSession()
    if(!window.location.pathname.endsWith("login.html")){
      window.location.href = "login.html"
    }
  }

  if(!response.ok){
    const fallback = rawText && rawText.length < 140 ? rawText : `HTTP ${response.status} ${response.statusText}`
    const error = new Error(payload.message || fallback || "Request failed")
    error.code = payload.code
    error.retryAfterSec = payload.retryAfterSec
    throw error
  }

  return payload
}

export function apiGet(path){
  return request(path, { method: "GET" })
}

export function apiPost(path, body){
  return request(path, {
    method: "POST",
    body: JSON.stringify(body)
  })
}
