import http from 'node:http';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { handleProfileLandmarks } from './profile-landmarks-handler.mjs';

const PORT = 5201;
const ANNOTATIONS_DIR = path.resolve(process.cwd(), 'data/annotations');
const IMAGES_DIR      = path.resolve(process.cwd(), 'data/images');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c.toString(); if (data.length > 2e6) reject(new Error('too large')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.url === '/api/profile-landmarks') {
    await handleProfileLandmarks(req, res);
    return;
  }

  // POST /api/annotations — save annotation JSON
  if (req.url === '/api/annotations' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      if (!existsSync(ANNOTATIONS_DIR)) mkdirSync(ANNOTATIONS_DIR, { recursive: true });
      const safeName = (body.filename ?? 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_');
      const fname = `${safeName}_${body.side}_${Date.now()}.json`;
      writeFileSync(path.join(ANNOTATIONS_DIR, fname), JSON.stringify(body, null, 2));
      console.log(`[annotations] Saved ${fname}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, file: fname }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  // GET /api/annotations/count — count saved annotations
  if (req.url === '/api/annotations/count' && req.method === 'GET') {
    const count = existsSync(ANNOTATIONS_DIR)
      ? readdirSync(ANNOTATIONS_DIR).filter(f => f.endsWith('.json')).length
      : 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`[profile-lab] API server running on http://localhost:${PORT}`);
  console.log(`[profile-lab] Open http://localhost:5200 in your browser`);
  if (!existsSync(ANNOTATIONS_DIR)) mkdirSync(ANNOTATIONS_DIR, { recursive: true });
  if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });
});
