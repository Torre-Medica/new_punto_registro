const fs = require('fs');
const files = fs.readdirSync('./public/img').filter(f => f.endsWith('.png'));
for (const f of files) {
  const buf = fs.readFileSync('./public/img/' + f);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  console.log(f + ': ' + w + 'x' + h);
}
