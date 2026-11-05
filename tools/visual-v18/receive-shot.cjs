/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');
const fs = require('fs');
const path = require('path');
const out = path.resolve(process.cwd(), 'evidence/v21');
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    fs.writeFileSync(path.join(out, 'cua-latest.jpg'), Buffer.concat(chunks));
    res.writeHead(204); res.end();
    setTimeout(() => server.close(), 1000);
  });
});
server.listen(3340, '127.0.0.1', () => console.log('shot receiver 3340'));
