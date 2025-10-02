import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';

const app = express();
app.use(cors());

// Serve models statically (models are located one level up from this app dir)
const modelsPath = path.resolve(process.cwd(), '..', 'models');
app.use('/models', express.static(modelsPath));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

io.on('connection', (socket) => {
  socket.on('ping', () => socket.emit('pong'));
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${PORT}`);
});


