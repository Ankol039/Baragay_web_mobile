import { writeFile, rename } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ROOT, requireSafe, digest } from './safety.mjs'
import { pack } from './storage.mjs'
import { groupFor } from './transform.mjs'
export const SQL_GROUPS = {
  residents: 'residents', staff: 'staff', surveys: 'surveys', survey_questions: 'surveys/questions', survey_choices: 'surveys/questions/choices',
  responses: 'responses', survey_results: 'responses/answers', resident_children: 'residents/children', resident_character_references: 'residents/characterReferences',
  resident_update_requests: 'nameAddressRequests', resident_family_requests: 'familyRequests', resident_delete_requests: 'deletionRequests', staff_update_requests: 'staffRequests',
  resident_residency_changes: 'residencyRecords', login_history: 'loginHistory'
}
export const GROUPS = [...new Set([...Object.values(SQL_GROUPS), 'users', 'identifierAliases', 'profileImages', 'pendingRequests', 'counters', 'familyRequests/children', 'familyRequests/characterReferences'])]
export const WARNING_LABELS = {
  missingPhotoFiles: 'Source photo references with missing local file (not fabricated)',
  historicalRequestOwnersMissing: 'Historical requests whose owner was already removed in MySQL (preserved)',
  orphanPendingOwners: 'Pending requests for removed owners (review required before production)',
  historicalAuditActorsMissing: 'Historical audit actors already removed in MySQL (preserved)',
  nonAsciiUsernameRequiresCollationReview: 'Non-ASCII usernames requiring MySQL collation review',
  familyRequestsWithoutReference: 'Legacy family proposals without a reference (review required)'
}
export async function verifyTarget(target, plan, mode, authSummary, idempotency = null) {
  const groups = Object.fromEntries(GROUPS.map(g => [g, { expected: plan.expectedGroups[g] || 0, actual: 0 }])), documents = new Map()
  for (const name of new Set(GROUPS.map(g => g.split('/').at(-1)))) {
    const snapshot = await target.db.collectionGroup(name).get()
    for (const doc of snapshot.docs) {
      const group = groupFor(doc.ref.path); requireSafe(group in groups, 'UNKNOWN_TARGET_COLLECTION')
      groups[group].actual++; documents.set(doc.ref.path, doc.data())
    }
  }
  const roots = await target.db.listCollections(), knownRoots = new Set(GROUPS.map(g => g.split('/')[0]))
  requireSafe(roots.every(r => knownRoots.has(r.id)), 'UNKNOWN_TARGET_COLLECTION')
  const relations = { responsesChecked: 0, responseOrphans: 0, questionsChecked: 0, questionOrphans: 0, choicesChecked: 0, choiceOrphans: 0, answersChecked: 0, answerOrphans: 0, peopleChecked: 0, peopleOrphans: 0 }
  for (const [path, d] of documents) {
    const group = groupFor(path), pieces = path.split('/')
    if (group === 'responses') {
      relations.responsesChecked++
      if (!documents.has(`surveys/${d.surveyId}`) || !documents.has(`residents/${d.residentUid}`) || documents.get(`users/${d.residentUid}`)?.role !== 'resident') relations.responseOrphans++
    } else if (group === 'surveys/questions') { relations.questionsChecked++; if (!documents.has(pieces.slice(0, 2).join('/'))) relations.questionOrphans++ }
    else if (group === 'surveys/questions/choices') { relations.choicesChecked++; if (!documents.has(pieces.slice(0, 4).join('/'))) relations.choiceOrphans++ }
    else if (group === 'responses/answers') {
      relations.answersChecked++; const parent = documents.get(pieces.slice(0, 2).join('/'))
      if (!parent || !documents.has(`surveys/${parent.surveyId}/questions/${d.questionId}`) || (d.choiceId && !documents.has(`surveys/${parent.surveyId}/questions/${d.questionId}/choices/${d.choiceId}`))) relations.answerOrphans++
    } else if (['residents/children', 'residents/characterReferences'].includes(group)) {
      relations.peopleChecked++; if (!documents.has(pieces.slice(0, 2).join('/'))) relations.peopleOrphans++
    }
  }
  let exactDocuments = 0
  for (const record of plan.records) {
    const actual = documents.get(record.path)
    requireSafe(actual, 'MISSING_TARGET_DOCUMENT')
    if (record.path.startsWith('counters/')) requireSafe(actual.value >= record.data.value && actual.value < 9999, 'COUNTER_CONTINUITY_FAILED')
    else requireSafe(digest(pack(actual)) === digest(pack(record.data)), 'TARGET_CONTENT_MISMATCH')
    exactDocuments++
  }
  const authUsers = []
  let token
  do { const page = await target.auth.listUsers(1000, token); authUsers.push(...page.users); token = page.pageToken } while (token)
  requireSafe(authUsers.length === plan.authUsers.length, 'AUTH_COUNT_MISMATCH')
  for (const account of plan.authUsers) {
    const found = authUsers.find(u => u.uid === account.uid)
    requireSafe(found && found.email === account.email && found.disabled === account.disabled, 'AUTH_IDENTITY_MISMATCH')
  }
  const countsMatch = Object.values(groups).every(g => g.expected === g.actual)
  const relationsMatch = ['responseOrphans', 'questionOrphans', 'choiceOrphans', 'answerOrphans', 'peopleOrphans'].every(k => relations[k] === 0)
  const temporaryLoginChecks = mode.dryRun ? await checkEmulatorPasswords(plan.authUsers) : null
  const result = { temporaryLoginChecks, passed: countsMatch && relationsMatch && Object.entries(SQL_GROUPS).every(([table, group]) => plan.sourceCounts[table] === groups[group].actual), dryRun: mode.dryRun, capturedAt: new Date().toISOString(), groups,
    sourceCounts: plan.sourceCounts, relations, authCount: authUsers.length, exactDocuments, authSummary, warnings: plan.warnings, counters: plan.counters, idempotency }
  await writeReport(result)
  requireSafe(result.passed, 'VERIFICATION_FAILED')
  return result
}
export function reportMarkdown(r) {
  // Public report is constructed ONLY from allowlisted labels and numeric totals.
  const localRun = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'medium', hourCycle: 'h23' }).format(new Date(r.capturedAt))
  const lines = ['# Migration verification', '', `Run: ${localRun} Asia/Manila (UTC+08:00). Target: ${r.dryRun ? '**local Emulator Suite only**' : '**explicitly approved production project**'}.`, '',
    `Result: **${r.passed ? 'PASS — all source-table and collection counts match; required relations intact' : 'FAIL'}**.`, '',
    'This report contains counts only. Exported rows, identifiers, emails, names, IPs, file paths, credentials, hashes and per-user outcomes remain in ignored migration/out/.', '',
    '## MySQL snapshot → primary Firestore collection counts', '', '| MySQL table | Expected rows | Imported documents | Match |', '| --- | ---: | ---: | --- |']
  for (const [table, group] of Object.entries(SQL_GROUPS)) { const g = r.groups[group]; lines.push(`| ${table} | ${Number(r.sourceCounts[table])} | ${g.actual} | ${Number(r.sourceCounts[table]) === g.actual ? 'PASS' : 'FAIL'} |`) }
  lines.push('', '## Every collection and subcollection', '', '| Collection group / parent | Expected | Actual |', '| --- | ---: | ---: |')
  for (const name of GROUPS) { const g = r.groups[name]; lines.push(`| ${name} | ${g.expected} | ${g.actual} |`) }
  lines.push('', '## Required relationships and exact content', '', `Checked every migrated document: **${r.exactDocuments}**. Values and Timestamp types match the transformed plan (counter values may safely be higher).`, '',
    '| Relation | Checked | Broken |', '| --- | ---: | ---: |',
    `| Response → survey + resident + resident user | ${r.relations.responsesChecked} | ${r.relations.responseOrphans} |`, `| Question → survey | ${r.relations.questionsChecked} | ${r.relations.questionOrphans} |`,
    `| Choice → question | ${r.relations.choicesChecked} | ${r.relations.choiceOrphans} |`, `| Answer → response + owned question/choice | ${r.relations.answersChecked} | ${r.relations.answerOrphans} |`, `| Family person → resident | ${r.relations.peopleChecked} | ${r.relations.peopleOrphans} |`, '',
    '## Authentication method', '', `Auth users expected/imported: **${r.authCount}/${r.authCount}**.`, '', '| Method/result | Accounts |', '| --- | ---: |')
  const labels = { bcryptAttempted: 'BCRYPT import attempted (original PHP hash bytes)', bcryptAccepted: 'BCRYPT payload accepted by importUsers', bcryptUsed: 'BCRYPT retained as the final credential', temporaryUsed: 'Identifier temporary-password fallback', emulatorTemporaryUsed: 'Emulator-only temporary password after accepted BCRYPT payload', reused: 'Existing matching migration accounts reused without password reset' }
  for (const [key, label] of Object.entries(labels)) lines.push(`| ${label} | ${Number(r.authSummary[key] || 0)} |`)
  if (r.dryRun) lines.push('', `Temporary credential/disabled-state checks against local Auth: **${Number(r.temporaryLoginChecks)}**. Every temporary credential has isFirstLogin=true in its matching user document.`, '', 'The local Auth emulator accepts imported hash payloads but does not perform BCRYPT password verification. Accepted BCRYPT payloads were therefore replaced **only in the emulator** with the identifier temporary password and isFirstLogin=true. This is not evidence that production rejects PHP bcrypt. Production will first try BCRYPT and fall back only on a hash-related rejection/unsupported source hash. No production Auth account was touched.')
  lines.push('', '## Number sequences', '', `Resident maximum suffix: **${r.counters.residentNumbers}**; staff maximum suffix: **${r.counters.staffNumbers}**. Counters retain at least these values, so the next allocation continues the global sequence without annual reset.`, '',
    '## Source-data issues preserved', '', '| Issue | Count |', '| --- | ---: |')
  for (const [key, label] of Object.entries(WARNING_LABELS)) lines.push(`| ${label} | ${Number(r.warnings[key] || 0)} |`)
  lines.push('', 'Missing image bytes are not invented: image document count equals readable, successfully compressed files, not stale photo_path references. Orphan request/audit rows retain deterministic historical UIDs; no fake resident/staff accounts are created. Source data is unchanged. These issues require review before a real migration; the production gate rejects unacknowledged warnings.', '',
    '## Rerun and scope', '', r.idempotency ? `Idempotency check: **${r.idempotency.passed ? 'PASS' : 'FAIL'}** — second import wrote ${r.idempotency.written} new documents, advanced ${r.idempotency.countersAdvanced} counters, and reused ${r.idempotency.authReused} Auth users without changing passwords.` : 'Separate idempotency check not requested for this invocation.', '',
    'MySQL was read in a repeatable-read, read-only consistent snapshot without executing config/db.php. Admin SDK imports bypass client Security Rules; the separate rule regression suite tests client authorization. A dry run writes only to local emulators. No real Firebase import, deployment, production credential read, MySQL write or destructive cleanup was performed for the emulator run.', '')
  return lines.join('\n')
}
export async function writeReport(result) {
  const path = resolve(ROOT, 'docs/migration-verification.md'), temp = `${path}.tmp`
  await writeFile(temp, reportMarkdown(result), { mode: 0o644 }); await rename(temp, path)
}

async function checkEmulatorPasswords(accounts) {
  requireSafe(process.env.FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9099', 'LOCAL_EMULATORS_REQUIRED')
  for (const a of accounts) {
    const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: a.email, password: a.identifier, returnSecureToken: true })
    })
    const result = await r.json()
    requireSafe(a.disabled ? result.error?.message === 'USER_DISABLED' : r.ok && result.localId === a.uid, 'EMULATOR_CREDENTIAL_CHECK_FAILED')
  }
  return accounts.length
}
