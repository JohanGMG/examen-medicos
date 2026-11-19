import net from 'node:net';

const server = net.createServer(socket => {
  socket.setEncoding('utf8');
  let pendiente = '';
  socket.on('data', chunk => {
    pendiente += chunk;
    let newline = pendiente.indexOf('\n');
    while (newline !== -1) {
      const linea = pendiente.slice(0, newline).trim();
      pendiente = pendiente.slice(newline + 1);
      procesarLinea(linea, socket);
      newline = pendiente.indexOf('\n');
    }
  });
  socket.on('error', error => console.log('Error en conexión TCP:', error.message));
});

function procesarLinea(linea: string, socket: net.Socket): void {
  try {
    const mensaje = JSON.parse(linea) as { tipo?: unknown; citaId?: unknown; paciente?: unknown; medicoId?: unknown };
    console.log(JSON.stringify({ tipo: mensaje.tipo, citaId: mensaje.citaId, paciente: mensaje.paciente, medicoId: mensaje.medicoId }));
    socket.write(`${JSON.stringify({ ok: true, recibido: String(mensaje.citaId ?? '') })}\n`);
  } catch {
    socket.write(`${JSON.stringify({ ok: false, error: 'JSON inválido' })}\n`);
  }
}

const port = Number(process.env.PORT ?? 4000);
server.listen(port, '0.0.0.0', () => console.log(`Notificaciones TCP escuchando en ${port}`));
