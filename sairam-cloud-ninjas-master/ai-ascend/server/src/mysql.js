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
    const [columnRows] = await connection.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'career_quiz_completed'
       LIMIT 1`,
      [process.env.MYSQL_DATABASE]
    )
    const hasCareerQuizColumn = Array.isArray(columnRows) && columnRows.length > 0
    if(!hasCareerQuizColumn){
      await connection.query(
        "ALTER TABLE users ADD COLUMN career_quiz_completed TINYINT(1) NOT NULL DEFAULT 1"
      )
    }
    await connection.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_key VARCHAR(120) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    )

    const migrationKey = "career_quiz_existing_users_backfill_v1"
    const [rows] = await connection.query(
      "SELECT migration_key FROM schema_migrations WHERE migration_key = ? LIMIT 1",
      [migrationKey]
    )
    const alreadyApplied = Array.isArray(rows) && rows.length > 0
    if(!alreadyApplied){
      await connection.query("UPDATE users SET career_quiz_completed = 1")
      await connection.query(
        "INSERT INTO schema_migrations (migration_key) VALUES (?)",
        [migrationKey]
      )
    }
  }finally{
    await connection.end()
  }
}
