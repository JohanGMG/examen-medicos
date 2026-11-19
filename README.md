# Evaluación 1 · Plataforma de citas médicas distribuida

**Estudiante:** Johan Medranda  
**GitHub:** [@JohanGMG](https://github.com/JohanGMG)

## Servicios

- **Citas** (`3000`): API REST para crear y consultar citas, reservar cupos en Agenda, notificar por TCP y calcular reportes en un hilo trabajador.
- **Agenda** (`3001`): API REST en memoria para consultar médicos y reservar cupos.
- **Notificaciones** (`4000`): servidor TCP que recibe eventos JSON por líneas y confirma cada mensaje.

## Levantar el sistema

```sh
docker compose up -d --build
docker compose ps
```

Para detenerlo: `docker compose down`.

## Rutas principales

- Citas: `GET /health`, `GET /citas`, `POST /citas`, `GET /reporte?n=15000000`
- Agenda: `GET /health`, `GET /medicos`, `POST /medicos/:id/reservar`
- Notificaciones: protocolo TCP, un objeto JSON por línea.

La página local `/` en Citas permite ejecutar y ver solicitudes HTTP de evidencia con código, tiempo y cuerpo.

## Prueba TCP

Con el servicio levantado: `node cliente-tcp.mjs localhost 4000` (modos opcionales: `partido`, `dos`, `invalido`).

## Experimentos y entrega

Las capturas y el análisis deben incluir hora visible y los resultados reales obtenidos en tu entorno. Si Docker no está disponible, inicia cada servicio con `npm start` en una terminal separada y explica en el PDF que ejecutaste las pruebas sin contenedores.
