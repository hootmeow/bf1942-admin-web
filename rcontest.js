const net = require('net');
const xor = (d, k) => {
  const o = Buffer.allocUnsafe(d.length);
  for (let i = 0; i < d.length; i++) o[i] = d[i] ^ k[i % k.length];
  return o;
};

const HOST = '165.245.175.206';
const PORT = 4711;

// variant: 'lenprefix' (our current), 'passonly', 'nullsep', 'sequential'
function tryAuth(user, pass, variant) {
  return new Promise(resolve => {
    let buf = Buffer.alloc(0);
    let authSent = false;
    const sock = new net.Socket();
    sock.setTimeout(5000);
    sock.connect(PORT, HOST);
    const label = '[' + variant + '] user=[' + user + '] pass=[' + pass + ']';
    sock.on('timeout', () => { console.log('  ' + label + ' -> TIMEOUT'); sock.destroy(); resolve(); });
    sock.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      if (!authSent && buf.length >= 10) {
        const key = buf.subarray(0, 10);
        const u = Buffer.from(user, 'latin1');
        const p = Buffer.from(pass, 'latin1');
        let pkt;
        if (variant === 'lenprefix') {
          // current: uint32LE(ulen) + xor(u) + uint32LE(plen) + xor(p)
          const lu = Buffer.allocUnsafe(4); lu.writeUInt32LE(u.length, 0);
          const lp = Buffer.allocUnsafe(4); lp.writeUInt32LE(p.length, 0);
          pkt = Buffer.concat([lu, xor(u, key), lp, xor(p, key)]);
        } else if (variant === 'passonly') {
          // just xor(pass) — no username, no length fields
          pkt = xor(p, key);
        } else if (variant === 'nullsep') {
          // xor(user + \0 + pass + \0) — null-separated, no lengths
          pkt = xor(Buffer.concat([u, Buffer.from([0]), p, Buffer.from([0])]), key);
        } else if (variant === 'sequential') {
          // uint32LE(ulen) + xor(u, key from 0) + uint32LE(plen) + xor(p, key from ulen%10)
          const lu = Buffer.allocUnsafe(4); lu.writeUInt32LE(u.length, 0);
          const lp = Buffer.allocUnsafe(4); lp.writeUInt32LE(p.length, 0);
          const xorSeq = (d, k, offset) => {
            const o = Buffer.allocUnsafe(d.length);
            for (let i = 0; i < d.length; i++) o[i] = d[i] ^ k[(i + offset) % k.length];
            return o;
          };
          pkt = Buffer.concat([lu, xorSeq(u, key, 0), lp, xorSeq(p, key, u.length % 10)]);
        }
        sock.write(pkt);
        authSent = true;
        buf = buf.subarray(10);
        if (buf.length >= 1) {
          const b = buf[0];
          console.log('  ' + label + ' -> ' + (b === 1 ? '*** SUCCESS ***' : 'FAILED (byte=' + b + ')'));
          sock.destroy(); setTimeout(resolve, 600); return;
        }
      } else if (authSent && buf.length >= 1) {
        const b = buf[0];
        console.log('  ' + label + ' -> ' + (b === 1 ? '*** SUCCESS ***' : 'FAILED (byte=' + b + ')'));
        sock.destroy(); setTimeout(resolve, 600);
      }
    });
    sock.on('error', e => { console.log('  ' + label + ' -> ERROR: ' + e.message); setTimeout(resolve, 600); });
  });
}

(async () => {
  const creds = [['derpadmin', 'derppassword'], ['admin', 'admin'], ['derp', 'derp']];
  const variants = ['lenprefix', 'passonly', 'nullsep', 'sequential'];
  console.log('Testing protocol variants against ' + HOST + ':' + PORT);
  for (const v of variants) {
    for (const [u, p] of creds) await tryAuth(u, p, v);
  }
  console.log('Done.');
})();
