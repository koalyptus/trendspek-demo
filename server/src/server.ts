import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({
  exposedHeaders: ['X-Merge-Result']
}));
app.use(express.json());

// RxDB replication: pull changes from server
app.post('/sync/pull', (req, res) => {
  const { checkpoint } = req.body as { checkpoint?: string };

  console.log(`[Pull] checkpoint=${checkpoint ?? 'none'}`);

  // Stub: return empty documents. Replication runs and status updates,
  // but no annotations flood the UI on every pull cycle.
  res.json({
    documents: [],
    checkpoint: new Date().toISOString()
  });
});

// --- Push conflict simulation ---

type SimulateMode = 'none' | 'successful-merge' | 'conflict';

// Track the exact document state we already returned a conflict for. RxDB's
// conflict handler resolves and immediately re-pushes the SAME doc state; that
// re-push must be accepted or replication loops forever. A NEW edit (different
// content) must conflict again. So we key on the serialized doc state, not the id.
//
// Bound the set: a long demo session (or a fuzzer) would otherwise grow it
// without limit. Eviction is FIFO — worst case an evicted state conflicts one
// extra time, which is harmless for a simulation.
const conflictedDocStates = new Set<string>()
const MAX_TRACKED_CONFLICT_STATES = 200

function trackConflictedState(state: string) {
  conflictedDocStates.add(state)
  while (conflictedDocStates.size > MAX_TRACKED_CONFLICT_STATES) {
    const oldest = conflictedDocStates.values().next().value
    if (oldest === undefined) break
    conflictedDocStates.delete(oldest)
  }
}

// Deterministic serialization with sorted keys (recursive). Bare
// JSON.stringify is key-order sensitive: the same logical doc with keys in a
// different order would produce a different string, the re-push after "Use
// server version" would miss MASTER_STATE_KEY, and replication would loop.
// NOTE: the client conflict handler in src/database/index.ts implements the
// same canonicalization — keep the two in sync.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? ''
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
    .filter(k => record[k] !== undefined && typeof record[k] !== 'function' && typeof record[k] !== 'symbol')
    .sort()
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`
}

function serializeDocState(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return ''
  // _rev/_meta/_attachments are RxDB-internal and change on every write —
  // exclude them so a re-push of the same logical content matches.
  const { _rev, _meta, _attachments, ...rest } = doc as Record<string, unknown>
  return stableStringify(rest)
}

// Intentionally static demo data: the simulation always returns THIS canned
// annotation as the server's "real master state", regardless of which doc the
// client pushed. That means the conflict dialog may show an annotation the
// user never edited — acceptable for the demo (it guarantees a reproducible
// conflict), but do not mistake it for a real merge response. A more faithful
// simulation would echo the pushed doc back with one field mutated.
const CONFLICT_ANNOTATION = {
  id: 'defect-1789955001947',
  assetId: 'asset-real-building-01',
  title: 'Broken!!!',
  description: 'Recorded from 3D surface depth pick.',
  severity: 'critical',
  status: 'open',
  positionXyz: [-4646076.953127894, 2553204.7217820967, -3534371.0327055342],
  templateId: 'tpl-coating-failure',
  templateValues: {
    approximateAreaM2: 1.2,
    coatingType: 'Elastomeric Waterproof Membrane',
    failureMode: 'Blistering & Delamination',
    remedialAction: 'Strip degraded membrane, pressure wash substrate at 3000 PSI, apply primer and 2-coat high-build waterproofing system.',
    waterIngressRisk: true
  },
  author: 'Field Inspector',
  createdAt: '2026-09-21T01:43:21.947Z',
  updatedAt: '2026-09-21T01:43:21.947Z',
  _deleted: false,
  _rev: '1-ggbgfeogrh',
  _meta: { lwt: 1789955001948.01 }
};

// Serialized master state we hand out as the conflict. Pushing this exact
// state back (i.e. the user chose "Use server version") must never conflict.
const MASTER_STATE_KEY = serializeDocState(CONFLICT_ANNOTATION);

// RxDB replication: push local changes to server
app.post('/sync/push', (req, res) => {
  const { documents } = req.body as { documents?: unknown[] };
  const mode = (req.headers['x-simulation-mode'] as SimulateMode) || 'none';

  console.log(`[Push] documentCount=${documents?.length ?? 0}, simulateMode=${mode}`);

  res.setHeader('Content-Type', 'application/json');

  if (mode !== 'conflict') {
    // Leaving conflict mode — reset tracking so the next conflict-mode push
    // simulates a fresh conflict.
    conflictedDocStates.clear();
  }

  if (mode === 'conflict') {
    // Push rows are { assumedMasterState, newDocumentState } — the doc lives
    // on newDocumentState, not on the row itself.
    const rows = (documents ?? []) as Array<{ newDocumentState?: unknown }>;
    const newRows = rows.filter(r => {
      const state = serializeDocState(r.newDocumentState);
      // Pushing the master state back ("Use server version") is never a conflict.
      if (state === MASTER_STATE_KEY) return false;
      return state !== '' && !conflictedDocStates.has(state);
    });
    if (rows.length > 0 && newRows.length === 0) {
      console.log('[Push] Already-conflicted or master states — accepting push');
      res.json([]);
      return;
    }
    console.log(`[Push] Simulating unsuccessful merge for ${newRows.length} doc(s) — returning real annotation as conflict`);
    newRows.forEach(r => trackConflictedState(serializeDocState(r.newDocumentState)));
    res.json([CONFLICT_ANNOTATION]);
    return;
  }

  if (mode === 'successful-merge') {
    console.log('[Push] Simulating successful property level merge');
    res.setHeader('X-Merge-Result', 'success');
    res.json([]);
    return;
  }

  // mode === 'none' — normal behaviour, no conflict
  console.log('[Push] No simulation — accepting push normally');
  res.json([]);
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[Server] Trendspek replication backend on http://localhost:${PORT}`);
  console.log(`[Server] POST /sync/pull  — RxDB pull changes`);
  console.log(`[Server] POST /sync/push  — RxDB push changes (X-Simulation-Mode: none|successful-merge|conflict)`);
});
