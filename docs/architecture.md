# Decisiones de arquitectura

La guía completa (capas, flujos, Mermaid y cómo escalar) está en:

**→ [ARQUITECTURA.md](./ARQUITECTURA.md)**

## Resumen corto

- Next.js App Router + Server Actions; Supabase Auth en cookies (`src/proxy.ts`).
- PostgreSQL es la autoridad: RLS + RPC `security definer` para PIN, marcación, planilla y cierres.
- No hay backend FastAPI adicional.
- Planillas guardan **snapshots** del empleado; no se recalculan al cambiar salarios.
- Dinero en centavos; zona `America/Costa_Rica`.
- Roles Auth: `admin` | `kiosk`. Empleado en operaciones: código + PIN (cookie aparte).
