An attempt to demonstrate a possible bug in nock@14's playback of
a recorded `fetch()` response when the response uses gzip compression.

# working case (no gzip)

A simple Node.js HTTP server that responds to "GET /" with some JSON.

```js
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
```

Run that:

```
$ node server.js
listening at http://localhost:3000/
```

The client, using nock.back in recording mode:

```js
// client.js
const nock = require('nock');
nock.back.setMode('record');
nock.back.fixtures = __dirname + '/recordings';

async function main() {
  const { nockDone } = await nock.back('no-compression.json');
  try {
    const res = await fetch('http://127.0.0.1:3000/');
    console.log('res: ', res);
    const bytes = await res.bytes();
    const s = new TextDecoder().decode(bytes);
    console.log(s);
  } finally {
    nockDone();
  }
}
main();
```

Run that once to generate the recording:

```
% npm ls nock
repro-nock-14-gzip-bug@1.0.0 /Users/trentm/tm/repro-nock-14-gzip-bug
└── nock@14.0.0

% node client.js
res:  Response {
  status: 200,
  statusText: 'OK',
  headers: Headers {
    'content-type': 'application/json',
    date: 'Wed, 29 Jan 2025 00:52:31 GMT',
    connection: 'keep-alive',
    'keep-alive': 'timeout=5',
    'transfer-encoding': 'chunked'
  },
  body: ReadableStream { locked: false, state: 'readable', supportsBYOB: true },
  bodyUsed: false,
  ok: true,
  redirected: false,
  type: 'basic',
  url: 'http://127.0.0.1:3000/'
}
{"ping":"pong"}
```

The recording ("recordings/no-compression.json"):

```json
[
    {
        "scope": "http://127.0.0.1:3000",
        "method": "GET",
        "path": "/",
        "body": "",
        "status": 200,
        "response": {
            "ping": "pong"
        },
        "rawHeaders": {
            "connection": "keep-alive",
            "content-type": "application/json",
            "date": "Wed, 29 Jan 2025 00:52:31 GMT",
            "keep-alive": "timeout=5",
            "transfer-encoding": "chunked"
        },
        "responseIsBinary": false
    }
]
```

Call the client again and the Response object is mostly the same:

```
% node client.js
res:  Response {
  status: 200,
  statusText: 'OK',
  headers: Headers {
    connection: 'keep-alive',
    'content-type': 'application/json',
    date: 'Wed, 29 Jan 2025 00:52:31 GMT',
    'keep-alive': 'timeout=5',
    'transfer-encoding': 'chunked'
  },
  body: ReadableStream { locked: false, state: 'readable', supportsBYOB: false },
  bodyUsed: false,
  ok: true,
  redirected: false,
  type: 'default',
  url: 'http://127.0.0.1:3000/'
}
{"ping":"pong"}
```

# failing case (using gzip compression)

```js
// server-gzip.js
const http = require('http');
const zlib = require('zlib');

const server = http.createServer((req, res) => {
  console.log('incoming request: %s %s %s', req.method, req.url, req.headers);
  req.resume();
  req.on('end', function () {
    const resBody = JSON.stringify({ ping: 'pong' });
    res.writeHead(200, {
      'content-type': 'application/json',
      'content-encoding': 'gzip',
    });
    const zipped = zlib.gzipSync(resBody);
    res.end(zipped);
  });
});

server.listen(3001, '127.0.0.1', () => {
  console.log('listening at http://127.0.0.1:3001/');
});
```

Run that and call it with curl to sanity check that gzip compression is working as expected:

```
$ node server-gzip.js
listening at http://localhost:3001/
incoming request: GET / { host: 'localhost:3001', 'user-agent': 'curl/8.7.1', accept: '*/*' }
```

```
$ curl -s http://localhost:3001/ | gunzip -
{"ping":"pong"}
```

Now the client, tweaked to use the 3001 port and a different recording name:

```js
// client-gzip.js
const nock = require('nock');
nock.back.setMode('record');
nock.back.fixtures = __dirname + '/recordings';

async function main() {
  const { nockDone } = await nock.back('gzip-compression.json');
  try {
    const res = await fetch('http://127.0.0.1:3001/');
    console.log('res: ', res);
    const bytes = await res.bytes();
    const s = new TextDecoder().decode(bytes);
    console.log(s);
  } finally {
    nockDone();
  }
}
main();
```

Run it once to generate the recording:

```
% node client-gzip.js
res:  Response {
  status: 200,
  statusText: 'OK',
  headers: Headers {
    'content-type': 'application/json',
    'content-encoding': 'gzip',
    date: 'Wed, 29 Jan 2025 01:11:24 GMT',
    connection: 'keep-alive',
    'keep-alive': 'timeout=5',
    'transfer-encoding': 'chunked'
  },
  body: ReadableStream { locked: false, state: 'readable', supportsBYOB: true },
  bodyUsed: false,
  ok: true,
  redirected: false,
  type: 'basic',
  url: 'http://127.0.0.1:3001/'
}
{"ping":"pong"}
```

The recording ("recordings/gzip-compression.json") looks good, I think:

```json
[
    {
        "scope": "http://127.0.0.1:3001",
        "method": "GET",
        "path": "/",
        "body": "",
        "status": 200,
        "response": [
            "1f8b0800000000000013ab562ac8cc4b57b2522ac8cf4b57aa0500a67de8f20f000000"
        ],
        "rawHeaders": {
            "connection": "keep-alive",
            "content-encoding": "gzip",
            "content-type": "application/json",
            "date": "Wed, 29 Jan 2025 01:11:24 GMT",
            "keep-alive": "timeout=5",
            "transfer-encoding": "chunked"
        },
        "responseIsBinary": false
    }
]
```

Run the client a second time to use the recording:

```
% node client-gzip.js
res:  Response {
  status: 200,
  statusText: '',
  headers: Headers {},
  body: ReadableStream { locked: false, state: 'readable', supportsBYOB: false },
  bodyUsed: false,
  ok: true,
  redirected: false,
  type: 'default',
  url: 'http://127.0.0.1:3001/'
}
{"ping":"pong"}
```

Notice that the headers are missing now.

(The reason I got here is that I was attempting to use nock@14 with the openai@5 library -- currently in alpha -- which has switched to using `fetch()`. I believe the missing headers here are causing the openai library to incorrectly change how it processes the response body. My guess is that without the `"content-type": "application/json"`, it is not attempting to parse the response.)

