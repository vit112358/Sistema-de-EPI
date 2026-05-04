import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../public/models');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const BASE = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

function download(file) {
  const dest = path.join(OUT, file);
  if (fs.existsSync(dest)) { console.log(`  skip  ${file}`); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    const get = (url) => https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) { get(res.headers.location); return; }
      res.pipe(out);
      out.on('finish', () => { out.close(); console.log(`  ✓  ${file}`); resolve(); });
    }).on('error', err => { fs.unlink(dest, () => {}); reject(err); });
    get(BASE + file);
  });
}

console.log('Baixando modelos face-api.js...');
for (const f of FILES) await download(f);
console.log('Concluído!');