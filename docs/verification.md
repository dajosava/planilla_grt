# Verificación de esta entrega

- ESLint y TypeScript: sin errores.
- Vitest: 18 pruebas aprobadas (importes, CSV y PostgreSQL).
- Next.js: compilación de producción exitosa.
- HTTP: portada e inicio de sesión responden; rutas admin y marcación redirigen al login sin configuración.
- Las migraciones se ejecutaron en PostgreSQL embebido PGlite con pgcrypto y roles simulados de Supabase. No se aplicaron a un proyecto remoto.
- No se pudo completar la comprobación visual en Chromium porque su descarga no estaba disponible en el entorno.
- Pendiente: prueba end-to-end en un proyecto Supabase real, en la tablet física y comparación de una planilla con el contador.
