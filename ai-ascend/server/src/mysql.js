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

async function hasColumn(connection, tableName, columnName){
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.MYSQL_DATABASE, tableName, columnName]
  )
  return Array.isArray(rows) && rows.length > 0
}

async function hasIndex(connection, tableName, indexName){
  const [rows] = await connection.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [process.env.MYSQL_DATABASE, tableName, indexName]
  )
  return Array.isArray(rows) && rows.length > 0
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

    if(!(await hasColumn(connection, "users", "xp"))){
      await connection.query("ALTER TABLE users ADD COLUMN xp INT NOT NULL DEFAULT 0 AFTER password_hash")
    }
    if(!(await hasColumn(connection, "chat_messages", "path_id"))){
      await connection.query(
        "ALTER TABLE chat_messages ADD COLUMN path_id VARCHAR(64) NOT NULL DEFAULT 'frontend' AFTER user_id"
      )
    }

    if(!(await hasIndex(connection, "chat_messages", "idx_chat_user_path_created_at"))){
      await connection.query(
        "CREATE INDEX idx_chat_user_path_created_at ON chat_messages (user_id, path_id, created_at)"
      )
    }
  }finally{
    await connection.end()
  }
}
