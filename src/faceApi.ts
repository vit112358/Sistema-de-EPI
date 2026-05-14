import * as faceapi from 'face-api.js';

let loaded = false;
let loading: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (loaded) return;
  if (loading) return loading;
  loading = (async () => {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    ]);
    loaded = true;
  })();
  return loading;
}

function toImgElement(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64;
  });
}

// Aplica brightness/contrast para compensar contraluz e câmeras ruins
function preprocessToCanvas(source: HTMLVideoElement | HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = source instanceof HTMLVideoElement ? source.videoWidth  : source.naturalWidth;
  const h = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  canvas.width  = w || 640;
  canvas.height = h || 480;
  const ctx = canvas.getContext('2d')!;
  ctx.filter = 'brightness(1.5) contrast(1.3)';
  ctx.drawImage(source, 0, 0);
  return canvas;
}

export async function extractDescriptor(base64: string): Promise<Float32Array | null> {
  await loadFaceModels();
  const img = await toImgElement(base64);
  const canvas = preprocessToCanvas(img);
  const result = await faceapi
    .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return result?.descriptor ?? null;
}

const MATCH_THRESHOLD = 0.6;

export function compareDescriptors(a: Float32Array, b: Float32Array): number {
  const dist = faceapi.euclideanDistance(a, b);
  if (dist >= MATCH_THRESHOLD) return 0;
  // curva de potência: dist=0→100%, dist=0.3→81%, dist=0.45→70%, dist=0.6→0%
  return Math.min(99, Math.round(Math.pow(1 - dist / MATCH_THRESHOLD, 0.3) * 100));
}

// ── Liveness detection ───────────────────────────────────────────────────────

function ptDist(a: faceapi.Point, b: faceapi.Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export async function detectLandmarks(video: HTMLVideoElement): Promise<faceapi.FaceLandmarks68 | null> {
  await loadFaceModels();
  const canvas = preprocessToCanvas(video);
  const result = await faceapi
    .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks();
  return result?.landmarks ?? null;
}

// Eye Aspect Ratio — left eye pts 36-41, right eye pts 42-47
export function computeEAR(landmarks: faceapi.FaceLandmarks68): number {
  const p = landmarks.positions;
  const leftEAR  = (ptDist(p[37], p[41]) + ptDist(p[38], p[40])) / (2 * ptDist(p[36], p[39]));
  const rightEAR = (ptDist(p[43], p[47]) + ptDist(p[44], p[46])) / (2 * ptDist(p[42], p[45]));
  return (leftEAR + rightEAR) / 2;
}

export const MODEL_VERSION = "ssd-v1";

export const descriptorToJson = (d: Float32Array): string =>
  MODEL_VERSION + ":" + JSON.stringify(Array.from(d));

export const jsonToDescriptor = (j: string): Float32Array => {
  const data = j.includes(":") ? j.slice(j.indexOf(":") + 1) : j;
  return new Float32Array(JSON.parse(data));
};

export const isCurrentModelDescriptor = (j: string): boolean =>
  j.startsWith(MODEL_VERSION + ":");