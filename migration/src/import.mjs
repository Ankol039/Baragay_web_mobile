import { requireSafe, digest } from './safety.mjs'
import { pack } from './storage.mjs'
export async function importFirestore(db, plan) {
  const ordinary = plan.records.filter(r => !r.path.startsWith('counters/'))
  const pending = [], stats = { written: 0, unchanged: 0, countersAdvanced: 0 }
  // Entire preflight precedes every write. Existing unequal documents are never
  // overwritten; interrupted runs resume only where data still matches the plan.
  for (let i = 0; i < ordinary.length; i += 200) {
    const chunk = ordinary.slice(i, i + 200), snapshots = await db.getAll(...chunk.map(r => db.doc(r.path)))
    for (const [j, snapshot] of snapshots.entries()) {
      const record = chunk[j]
      if (snapshot.exists) { requireSafe(digest(pack(snapshot.data())) === digest(pack(record.data)), 'TARGET_DOCUMENT_CONFLICT'); stats.unchanged++ }
      else pending.push(record)
    }
  }
  // create(), not set(), also protects against a concurrent writer after preflight.
  // Up to 100 docs / ~4 MiB per batch keeps compressed images below request limits.
  let batch = db.batch(), count = 0, bytes = 0
  for (const record of pending) {
    const size = Buffer.byteLength(JSON.stringify(pack(record.data)))
    requireSafe(size < 900000, 'DOCUMENT_TOO_LARGE')
    if (count && (count >= 100 || bytes + size > 4 * 1024 * 1024)) { await batch.commit(); batch = db.batch(); count = 0; bytes = 0 }
    batch.create(db.doc(record.path), record.data); count++; bytes += size; stats.written++
  }
  if (count) await batch.commit()
  for (const record of plan.records.filter(r => r.path.startsWith('counters/'))) {
    await db.runTransaction(async tx => {
      const ref = db.doc(record.path), current = await tx.get(ref)
      if (!current.exists) { tx.create(ref, record.data); stats.countersAdvanced++ }
      else {
        requireSafe(Number.isInteger(current.data().value) && current.data().value <= 9999, 'INVALID_EXISTING_COUNTER')
        if (current.data().value < record.data.value) { tx.update(ref, record.data); stats.countersAdvanced++ }
      }
    })
  }
  return stats
}
