import express from 'express';

type Medico = { id: string; nombre: string; especialidad: string; cupos: number };
const medicos: Medico[] = [
  { id: 'MED-01', nombre: 'Dra. Amaya Cárdenas', especialidad: 'Medicina general', cupos: 20 },
  { id: 'MED-02', nombre: 'Dr. Elian Vicuña', especialidad: 'Pediatría', cupos: 7 },
  { id: 'MED-03', nombre: 'Dra. Maite Zambrano', especialidad: 'Cardiología', cupos: 0 },
  { id: 'MED-04', nombre: 'Dr. Iker Paredes', especialidad: 'Dermatología', cupos: 12 },
  { id: 'MED-05', nombre: 'Dra. Salomé Celi', especialidad: 'Neurología', cupos: 5 },
];
const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.json({ estado: 'ok', servicio: 'agenda' }));
app.get('/medicos', (_req, res) => res.json(medicos));
app.post('/medicos/:id/reservar', async (req, res) => {
  const delay = Number(process.env.RETARDO_MS ?? 0);
  if (Number.isFinite(delay) && delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
  const medico = medicos.find(item => item.id === req.params.id);
  if (!medico) return res.status(404).json({ mensaje: 'Médico no encontrado' });
  if (medico.cupos <= 0) return res.status(409).json({ mensaje: 'No quedan cupos para este médico' });
  medico.cupos -= 1;
  return res.json({ medicoId: medico.id, cuposRestantes: medico.cupos });
});
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`Agenda escuchando en ${port}`));
