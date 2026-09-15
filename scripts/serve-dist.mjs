// Serves a built Angular bundle the way the nginx image does: static files,
// and index.html for every route that is not a file. Used by the browser smoke
// tests in CI so they run against the exact bundle that ships.
//
//   node scripts/serve-dist.mjs <dir> [port]

import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';

const [dir = 'dist/almonium-fe/browser', port = '4200'] = process.argv.slice(2);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
};

async function resolve(urlPath) {
  const relative = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const candidate = join(dir, relative);
  try {
    if ((await stat(candidate)).isFile()) {
      return candidate;
    }
  } catch {
    // fall through to the SPA entry
  }
  return join(dir, 'index.html');
}

createServer(async (request, response) => {
  const file = await resolve(request.url ?? '/');
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
}).listen(Number(port), '127.0.0.1', () => {
  console.log(`serving ${dir} on http://127.0.0.1:${port}`);
});
