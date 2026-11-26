# Marcación offline (tablet)

Cómo la tablet de marcación guarda marcas sin red y las reenvía cuando vuelve internet.

## Flujo

1. El empleado marca en `/marcacion`.
2. Si **no hay salida real a internet**, la marca se guarda en **IndexedDB** (`pending`) con foto, PIN, tipo y `occurredAt` (hora de la tablet).
3. Cuando la red vuelve, la cola se envía al servidor con el RPC de punch (incluye `requestId` para idempotencia).
4. Si el servidor acepta → se borra de la cola. Si hay error de negocio (PIN, doble entrada, etc.) → pasa a `failed` (botón **Reintentar**).

Archivos clave:

| Pieza | Ruta |
|---|---|
| UI kiosco | `src/app/marcacion/terminal.tsx` |
| Cola IndexedDB | `src/lib/offline-punches.ts` |
| Probe de red | `src/lib/connectivity.ts` |
| Health ping | `src/app/api/health/route.ts` |
| Acción servidor | `src/app/marcacion/actions.ts` |

## Problema: Wi‑Fi “congelado” en tablets

`navigator.onLine` y los eventos `online` / `offline` del navegador **no son fiables** en Android/Chrome:

- La tablet puede quedar asociada al AP **sin salida real** (DNS, gateway, radio dormida).
- A veces `navigator.onLine` queda en `false` y **nunca** dispara `online` hasta apagar/encender el Wi‑Fi.
- Si el sync solo escuchaba ese evento, la cola en IndexedDB no arrancaba sola.

## Mejora: heartbeat de conectividad real

Cada **15 segundos** (y al volver a la pestaña / al montar) la tablet hace un `GET` a:

```http
GET /api/health?t=<timestamp>
Cache-Control: no-store
```

- Respuesta `ok` → se considera **alcanzable** y se llama a `flushQueue()` (envío de pendientes).
- Fallo / timeout (~4 s) → se marca offline; las nuevas marcas van a IndexedDB.
- Los eventos `online`/`offline` siguen usándose de forma **optimista**, pero la fuente de verdad es el probe.

También:

- Tras un `punch` online OK → se confirma alcanzable y se vacía cola residual.
- Si el envío de cola falla por red → se marca no alcanzable (el siguiente heartbeat reintenta).
- **Reintentar** (fallidos) primero hace un probe; si no hay red, no reencola en falso.

## Qué no hace falta al desplegar

- **No** reinstalar la PWA.
- **No** apagar/encender el Wi‑Fi para “despertar” el sync.
- Tras un deploy, el SW nuevo (`skipWaiting` + `clientsClaim`) dispara `controllerchange` en el kiosco y **recarga sola** la PWA de marcación/operaciones. `/api/*` va por `NetworkOnly` (sin cache NetworkFirst) para que el probe de health no quede con un “ok” viejo ni con sockets colgados.

Las marcas ya guardadas en IndexedDB **se conservan** al actualizar.

## Banner en pantalla

- Sin red: “Sin internet — las marcas se guardan en la tablet…”
- Con red y pendientes: “Enviando / Pendientes N marcaciones offline”
- Fallidos de negocio: botón **Reintentar**

## Presencia en el panel admin (header)

Además del ping liviano a `/api/health`, cuando hay red la tablet registra presencia en Supabase:

| Pieza | Detalle |
|---|---|
| Tabla | `kiosk_presence` (migración `202611210001_kiosk_presence.sql`) |
| RPC write | `report_kiosk_presence` (solo rol **kiosk**) |
| RPC read | `list_kiosk_presence` (solo **admin**) |
| Frecuencia DB | ~cada **60 s** (o al recuperar red); el probe local sigue cada 15 s |
| Offline | Si no hay heartbeat reciente (**90 s**), el header muestra “Reloj sin señal” |
| UI | Chip en el topbar admin (`KioskConnectionStatus`), refresh cada 30 s |

Sin migración aplicada o sin tablet abierta en `/marcacion`, el chip dice **Reloj sin datos**.

## Pruebas

```bash
npm test -- tests/connectivity.test.ts
npm test -- tests/offline-punches.test.ts
npm test -- tests/kiosk-presence.test.ts
```

Detalle en `docs/tests.md`.
