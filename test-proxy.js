const http = require('http');
const net = require('net');

function startProxy(allowedHosts, allowedUrls) {
    let proxyServer = null;
    if (proxyServer) proxyServer.close();

    proxyServer = http.createServer((req, res) => {
        const host = (req.headers.host || '').split(':')[0].toLowerCase();
        const fullUrl = `http://${host}${req.url}`;

        // Check if hostname is allowed
        const hostAllowed = allowedHosts.has(host) || allowedHosts.has('www.' + host) ||
                          host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

        // Check if specific URL is allowed
        const urlAllowed = allowedUrls.some(allowedUrl => {
            try {
                const allowed = new URL(allowedUrl);
                const requested = new URL(fullUrl);
                return allowed.hostname === requested.hostname &&
                       requested.pathname.startsWith(allowed.pathname);
            } catch (e) {
                return false;
            }
        });

        if (hostAllowed || urlAllowed) {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end('<html><body><h1>✓ Allowed by SuperFokus</h1></body></html>');
        } else {
            res.writeHead(403, {'Content-Type': 'text/html'});
            res.end('<html><body style="font-family:Arial;margin:50px;background:#f8d7da;"><h1>🚫 Site Blocked</h1><p>This website is blocked by SuperFokus.</p></body></html>');
        }
    });

    // Handle HTTPS CONNECT requests properly
    proxyServer.on('connect', (req, clientSocket, head) => {
        const host = req.url.split(':')[0].toLowerCase();
        const port = req.url.split(':')[1] || 443;

        // Check if hostname is allowed
        let hostAllowed = allowedHosts.has(host) || allowedHosts.has('www.' + host) ||
                          host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

        if (!hostAllowed && allowedUrls) {
            hostAllowed = allowedUrls.some(allowedUrl => {
                try {
                    const allowed = new URL(allowedUrl);
                    return allowed.hostname === host || allowed.hostname === 'www.' + host || 'www.' + allowed.hostname === host;
                } catch (e) {
                    return false;
                }
            });
        }

        if (hostAllowed) {
            // For allowed HTTPS sites, establish tunnel
            const serverSocket = net.connect(port, host, () => {
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                serverSocket.write(head);
                serverSocket.pipe(clientSocket);
                clientSocket.pipe(serverSocket);
            });

            serverSocket.on('error', () => {
                try { clientSocket.end(); } catch (e) {}
            });

            clientSocket.on('error', () => {
                try { serverSocket.end(); } catch (e) {}
            });
        } else {
            // Block disallowed HTTPS
            clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        }
    });

    proxyServer.listen(8080, '127.0.0.1', () => {
        console.log('✓ SuperFokus proxy server listening on localhost:8080 (Allow-only mode)');
    });

    proxyServer.on('error', (err) => {
        console.error('Proxy server error:', err);
    });

    return proxyServer;
}

// Test data - simulate what main.js does now
const allowedHosts = new Set(['google.com']); // Only domains go here
const allowedUrls = ['https://youtube.com/watch']; // Specific URLs go here

console.log('Starting test proxy...');
const server = startProxy(allowedHosts, allowedUrls);

console.log('Proxy started. Testing...');

// Test blocked URL (youtube.com/shorts should be blocked)
setTimeout(() => {
  const req = http.request({
    host: 'localhost',
    port: 8080,
    path: '/shorts',
    headers: { 'Host': 'youtube.com' }
  }, (res) => {
    console.log('Blocked URL (youtube.com/shorts) Status:', res.statusCode);
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => console.log('Response:', data.substring(0, 100)));
  });
  req.on('error', (err) => console.log('Blocked URL Error:', err.message));
  req.end();

  // Test allowed URL (youtube.com/watch should be allowed)
  setTimeout(() => {
    const req2 = http.request({
      host: 'localhost',
      port: 8080,
      path: '/watch?v=test',
      headers: { 'Host': 'youtube.com' }
    }, (res) => {
      console.log('Allowed URL (youtube.com/watch) Status:', res.statusCode);
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => console.log('Response:', data.substring(0, 100)));
    });
    req2.on('error', (err) => console.log('Allowed URL Error:', err.message));
    req2.end();

    // Clean up
    setTimeout(() => {
      server.close();
      console.log('Test complete.');
    }, 2000);
  }, 1000);
}, 1000);