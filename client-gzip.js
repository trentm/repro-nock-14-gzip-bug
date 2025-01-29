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
