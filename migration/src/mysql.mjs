import mysql from 'mysql2/promise'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ROOT, requireSafe, digest } from './safety.mjs'
import { savePrivate } from './storage.mjs'
import { exportPhotos } from './photos.mjs'
export const TABLES = ['residents', 'staff', 'surveys', 'survey_questions', 'survey_choices', 'responses', 'survey_results',
  'resident_children', 'resident_character_references', 'resident_update_requests', 'resident_family_requests',
  'resident_delete_requests', 'staff_update_requests', 'resident_residency_changes', 'login_history']
const KEYS = ['resident_id', 'staff_id', 'survey_id', 'question_id', 'choice_id', 'response_id', 'answer_id', 'child_id', 'reference_id', 'request_id', 'request_id', 'request_id', 'request_id', 'change_id', 'log_id']
export function literalSettings(source) {
  const settings = {}
  for (const match of source.matchAll(/define\(\s*['"](DB_HOST|DB_USER|DB_PASS|DB_NAME|DB_PORT)['"]\s*,\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\d+)\s*\)\s*;/g)) {
    const raw = match[2]
    if (raw.startsWith("'")) settings[match[1]] = raw.slice(1, -1).replace(/\\([\\'])/g, '$1')
    else if (raw.startsWith('"')) { requireSafe(!raw.includes('$'), 'NONLITERAL_MYSQL_CONFIG'); settings[match[1]] = JSON.parse(raw) }
    else settings[match[1]] = Number(raw)
  }
  requireSafe(Object.keys(settings).length === 5, 'MYSQL_ENV_OR_LITERAL_CONFIG_REQUIRED')
  return { host: settings.DB_HOST, user: settings.DB_USER, password: settings.DB_PASS, database: settings.DB_NAME, port: Number(settings.DB_PORT) }
}
export async function connectionOptions(env = process.env) {
  if (['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'MYSQL_PORT'].some(k => k in env)) {
    requireSafe(['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'MYSQL_PORT'].every(k => k in env), 'MYSQL_ENV_INCOMPLETE')
    return { host: env.MYSQL_HOST, user: env.MYSQL_USER, password: env.MYSQL_PASSWORD, database: env.MYSQL_DATABASE, port: Number(env.MYSQL_PORT) }
  }
  // Parse literal defines only. Never execute/include the self-healing PHP bootstrap.
  return literalSettings(await readFile(resolve(ROOT, 'config/db.php'), 'utf8'))
}
export async function exportMysql() {
  const db = await mysql.createConnection({ ...await connectionOptions(), dateStrings: true, timezone: '+08:00', supportBigNumbers: true, bigNumberStrings: true, multipleStatements: false })
  try {
    await db.query("SET time_zone = '+08:00'")
    await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
    const tables = {}, counts = {}
    for (const [i, name] of TABLES.entries()) {
      const [rows] = await db.query(`SELECT * FROM \`${name}\` ORDER BY \`${KEYS[i]}\``)
      const [[count]] = await db.query(`SELECT COUNT(*) AS c FROM \`${name}\``)
      requireSafe(rows.length === Number(count.c), 'MYSQL_SNAPSHOT_COUNT_MISMATCH')
      tables[name] = rows; counts[name] = rows.length
    }
    await db.rollback()
    const media = await exportPhotos(tables)
    const snapshot = { schemaVersion: 1, capturedAt: new Date().toISOString(), timeZone: '+08:00', counts, tables, ...media }
    snapshot.digest = digest({ tables, photos: media.photos, warnings: media.warnings })
    await savePrivate('mysql-export.json', snapshot)
    return snapshot
  } finally { await db.end() }
}
