import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
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

// RxDB replication: push local changes to server
app.post('/sync/push', (req, res) => {
  const { documents } = req.body as { documents?: unknown[] };

  console.log(`[Push] documentCount=${documents?.length ?? 0}`);

  // Stub: accept anything, return success ack
  res.json([]);
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[Server] Trendspek replication backend on http://localhost:${PORT}`);
  console.log(`[Server] POST /sync/pull  — RxDB pull changes`);
  console.log(`[Server] POST /sync/push  — RxDB push changes`);
});
