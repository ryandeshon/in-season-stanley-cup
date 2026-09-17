// Serve the production build locally for the hosted-preview browser gate.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(process.argv[2] || 'dist');
const types = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost:8092');
    let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(`${root}${path.sep}`) && file !== root) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      if ((await fs.stat(file)).isDirectory())
        file = path.join(file, 'index.html');
      await fs.access(file);
    } catch {
      if (
        path.extname(url.pathname) ||
        url.pathname.startsWith('/__arcade-preview/')
      ) {
        res.writeHead(404);
        res.end();
        return;
      }
      file = path.join(root, 'index.html');
    }
    try {
      res.setHeader(
        'Content-Type',
        types[path.extname(file)] || 'application/octet-stream'
      );
      res.setHeader('Cache-Control', 'no-store');
      res.end(await fs.readFile(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(8092, '127.0.0.1', () =>
    console.log('Hosted preview test server: http://localhost:8092')
  );
