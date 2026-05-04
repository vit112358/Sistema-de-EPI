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

export async function extractDescriptor(base64: string): Promise<Float32Array | null> {
  await loadFaceModels();
  const img = await toImgElement(base64);
  const result = await faceapi
    .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
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

export const MODEL_VERSION = "ssd-v1";

export const descriptorToJson = (d: Float32Array): string =>
  MODEL_VERSION + ":" + JSON.stringify(Array.from(d));

export const jsonToDescriptor = (j: string): Float32Array => {
  const data = j.includes(":") ? j.slice(j.indexOf(":") + 1) : j;
  return new Float32Array(JSON.parse(data));
};

export const isCurrentModelDescriptor = (j: string): boolean =>
  j.startsWith(MODEL_VERSION + ":");