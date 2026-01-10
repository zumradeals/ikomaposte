const http = require('http');
const fs = require('fs');
const path = require('path');

// Port configurable via env
const PORT = parseInt(process.env.PORT, 10) || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

// Read version from package.json
let version = 'unknown';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  version = pkg.version || 'unknown';
} catch (e) {
  console.warn('Could not read package.json version');
}

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Health endpoint OBLIGATOIRE IKOMA
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      version, 
      timestamp: new Date().toISOString() 
    }));
    return;
  }

  // Serve static files
  let filePath = path.join(DIST_DIR, pathname);
  
  // Default to index.html for SPA routing
  if (!path.extname(filePath)) {
    const potentialFile = filePath + '.html';
    if (fs.existsSync(potentialFile)) {
      filePath = potentialFile;
    } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
    } else {
      // SPA fallback
      filePath = path.join(DIST_DIR, 'index.html');
    }
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    // Fallback to index.html for SPA
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    // Cache static assets (except HTML)
    const cacheControl = ext === '.html' 
      ? 'no-cache' 
      : 'public, max-age=31536000, immutable';

    // Headers sécurité
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block'
    });
    res.end(content);
  });
});

// Écoute sur 0.0.0.0 (OBLIGATOIRE IKOMA)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`IKOMA POSTE server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Version: ${version}`);
});
