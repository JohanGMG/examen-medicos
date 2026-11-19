import express from 'express';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

type Cita = { id: string; paciente: string; medicoId: string; creadaEn: string; notificada: boolean; motivoNotificacion?: string };
const citas: Cita[] = [];
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
const agendaUrl = process.env.AGENDA_URL ?? 'http://localhost:3001';
const agendaTimeout = positiveInt(process.env.AGENDA_TIMEOUT_MS, 2000);
const notificationHost = process.env.NOTIFICACIONES_HOST ?? 'localhost';
const notificationPort = positiveInt(process.env.NOTIFICACIONES_PORT, 4000);
const notificationTimeout = positiveInt(process.env.NOTIFICACIONES_TIMEOUT_MS, 1000);
function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

app.get('/health', (_req, res) => res.json({ estado: 'ok', servicio: 'citas' }));
app.get('/citas', (_req, res) => res.json(citas));

app.post('/citas', async (req, res) => {
  const paciente = typeof req.body?.paciente === 'string' ? req.body.paciente.trim() : '';
  const medicoId = typeof req.body?.medicoId === 'string' ? req.body.medicoId.trim() : '';
  if (!paciente || !medicoId) return res.status(400).json({ motivo: 'paciente y medicoId son obligatorios' });

  const started = Date.now();
  let agendaResponse: Response;
  try {
    agendaResponse = await fetch(`${agendaUrl.replace(/\/$/, '')}/medicos/${encodeURIComponent(medicoId)}/reservar`, {
      method: 'POST', signal: AbortSignal.timeout(agendaTimeout),
    });
  } catch (error) {
    const duracionMs = Date.now() - started;
    const err = error as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException };
    const cause = err.cause ?? err;
    const timeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    const motivo = timeout ? `Tiempo de espera agotado (${agendaTimeout} ms)` : `No se pudo conectar con Agenda (${cause.code ?? err.code ?? err.message})`;
    console.log('Error al consultar Agenda:', motivo, { duracionMs });
    return res.status(503).json({ motivo, duracionMs });
  }
  if (agendaResponse.status === 404 || agendaResponse.status === 409) {
    const body = await agendaResponse.json().catch(() => ({})) as Record<string, unknown>;
    return res.status(agendaResponse.status).json(body);
  }
  if (agendaResponse.status !== 200) {
    const motivo = `Agenda respondió con HTTP ${agendaResponse.status}`;
    console.log('Error al consultar Agenda:', motivo, { duracionMs: Date.now() - started });
    return res.status(502).json({ motivo, duracionMs: Date.now() - started });
  }
  const reservation = await agendaResponse.json().catch(() => ({})) as { cuposRestantes?: number };
  const cita: Cita = { id: randomUUID(), paciente, medicoId, creadaEn: new Date().toISOString(), notificada: false };
  citas.push(cita);
  const notification = await notify(cita);
  cita.notificada = notification.ok;
  if (!notification.ok) cita.motivoNotificacion = notification.reason;
  return res.status(201).json({ ...cita, ...(reservation.cuposRestantes === undefined ? {} : { cuposRestantes: reservation.cuposRestantes }) });
});

app.get('/reporte', (req, res) => {
  const parsed = Number(req.query.n ?? 8_000_000);
  const n = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 8_000_000;
  const started = Date.now();
  const worker = new Worker(path.join(__dirname, 'workers', 'primos.js'), { workerData: { n } });
  let settled = false;
  const fail = (error: Error) => {
    if (settled) return;
    settled = true;
    res.status(500).json({ motivo: 'Falló el hilo trabajador', detalle: error.message });
  };
  worker.once('message', (result: { primos: number }) => {
    if (settled) return;
    settled = true;
    res.json({ modo: 'worker', n, primos: result.primos, citasRegistradas: citas.length, duracionMs: Date.now() - started });
  });
  worker.once('error', fail);
  worker.once('exit', code => { if (code !== 0) fail(new Error(`Worker terminó con código ${code}`)); });
});

function notify(cita: Cita): Promise<{ ok: true } | { ok: false; reason: string }> {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: notificationHost, port: notificationPort });
    let buffer = '';
    let finished = false;
    const finish = (result: { ok: true } | { ok: false; reason: string }) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: `Tiempo de espera agotado (${notificationTimeout} ms)` }), notificationTimeout);
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(`${JSON.stringify({ tipo: 'CITA_CREADA', citaId: cita.id, paciente: cita.paciente, medicoId: cita.medicoId })}\n`));
    socket.on('data', chunk => {
      buffer += chunk;
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      try {
        const response = JSON.parse(buffer.slice(0, newline)) as { ok?: boolean; error?: string };
        finish(response.ok ? { ok: true } : { ok: false, reason: response.error ?? 'Notificaciones rechazó el aviso' });
      } catch { finish({ ok: false, reason: 'Respuesta inválida de Notificaciones' }); }
    });
    socket.on('error', error => {
      const err = error as NodeJS.ErrnoException;
      finish({ ok: false, reason: `No se pudo conectar con Notificaciones (${err.code ?? err.message})` });
    });
  });
}

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Citas escuchando en ${port}`));
