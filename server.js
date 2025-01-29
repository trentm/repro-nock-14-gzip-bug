// server.js
const http = require('http');

const server = http.createServer((req, res) => {
  console.log('incoming request: %s %s %s', req.method, req.url, req.headers);
  req.resume();
  req.on('end', function () {
    const resBody = JSON.stringify({ ping: 'pong' });
    res.writeHead(200, {
      'content-type': 'application/json',
    });
    res.end(resBody);
  });
});

server.listen(3000, '127.0.0.1', () => {
  console.log('listening at http://127.0.0.1:3000/');
});
