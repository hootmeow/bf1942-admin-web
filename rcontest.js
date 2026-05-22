const net = require('net');
const xor = (d, k) => {
  const o = Buffer.allocUnsafe(d.length);
  for (let i = 0; i < d.length; i++) o[i] = d[i] ^ k[i % k.length];
  return o;
};

const HOST = '165.245.175.206';
const PORT = 4711;
const USER = 'derpadmin';
const PASS = 'derppassword';

let buf = Buffer.alloc(0);
let authSent = false;
const sock = new net.Socket();
sock.setTimeout(5000);

sock.connect(PORT, HOST, () => console.log('TCP connected to ' + HOST + ':' + PORT));

sock.on('timeout', () => {
  console.log('Timeout - no response from server');
  sock.destroy();
});

sock.on('data', chunk => {
  buf = Buffer.concat([buf, chunk]);
  console.log('Buffered ' + buf.length + ' bytes');

  if (!authSent && buf.length >= 10) {
    const key = buf.subarray(0, 10);
    console.log('XOR key received: ' + key.toString('hex'));
    const u = Buffer.from(USER, 'latin1');
    const p = Buffer.from(PASS, 'latin1');
    const lu = Buffer.allocUnsafe(4);
    const lp = Buffer.allocUnsafe(4);
    lu.writeUInt32LE(u.length, 0);
    lp.writeUInt32LE(p.length, 0);
    const pkt = Buffer.concat([lu, xor(u, key), lp, xor(p, key)]);
    console.log('Sending credentials: user=' + USER + ' pass=' + PASS);
    sock.write(pkt);
    authSent = true;
    buf = buf.subarray(10);
  } else if (authSent && buf.length >= 1) {
    const b = buf[0];
    console.log('Auth response byte: ' + b + ' -> ' + (b === 1 ? 'SUCCESS' : 'FAILED'));
    sock.destroy();
  }
});

sock.on('error', e => console.error('Socket error: ' + e.message));
sock.on('close', () => console.log('Connection closed'));
