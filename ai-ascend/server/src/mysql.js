import mysql from "mysql2/promise"
import dotenv from "dotenv"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

dotenv.config()

const requiredEnv = ["MYSQL_HOST", "MYSQL_PORT", "MYSQL_USER", "MYSQL_DATABASE"]
const missing = requiredEnv.filter(key => !process.env[key])

if(missing.length > 0){
  throw new Error(`Missing MySQL env vars: ${missing.join(", ")}`)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "schema.sql")

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

export async function dbQuery(sql, params = []){
  const [rows] = await pool.execute(sql, params)
  return rows
}

export async function initDatabase(){
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || "",
    multipleStatements: true
  })

  try{
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.MYSQL_DATABASE}\``)
    await connection.query(`USE \`${process.env.MYSQL_DATABASE}\``)
    const schemaSql = await fs.readFile(SCHEMA_PATH, "utf-8")
    await connection.query(schemaSql)
  }finally{
    await connection.end()
  }
}
