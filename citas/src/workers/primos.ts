import { parentPort, workerData } from 'node:worker_threads';

const n = Math.max(0, Math.floor(Number(workerData.n)));
const sieve = new Uint8Array(n);
if (n > 2) sieve.fill(1, 2);
for (let p = 2; p * p < n; p += 1) {
  if (sieve[p]) for (let multiple = p * p; multiple < n; multiple += p) sieve[multiple] = 0;
}
let primos = 0;
for (let i = 2; i < n; i += 1) if (sieve[i]) primos += 1;
parentPort?.postMessage({ primos });
