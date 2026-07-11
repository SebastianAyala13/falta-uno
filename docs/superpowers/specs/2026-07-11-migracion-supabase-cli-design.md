# Migración a Supabase CLI (migraciones versionadas) — Design

**Fecha:** 2026-07-11
**Estado:** Aprobado (diseño). Pendiente: plan de implementación.

## Contexto y problema

Hoy el schema de la base se maneja con un enfoque **idempotente sin versionar**:

- `supabase/schema.sql` (~36 KB) es la fuente de verdad: `CREATE TABLE IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` + `CREATE POLICY`, `CREATE OR REPLACE`.
- `scripts/supabase-setup.mjs` (`pnpm supa:setup`) lo aplica al Postgres de prod vía el cliente `pg`,
  con TLS fail-closed (pin SHA-256 de la CA raíz de Supabase). El mismo script despliega Edge Functions
  y carga secrets, leyendo credenciales de `.supabase-deploy.env` (gitignoreado).

Limitaciones del enfoque actual:

- **No hay historial ni versión**: no se sabe "en qué estado está" una base salvo inspeccionándola.
- **No expresa cambios destructivos/transformadores**: renames, cambios de tipo, drops y backfills hay
  que escribirlos a mano y con cuidado de idempotencia; un `schema.sql` basado en `IF NOT EXISTS` no los modela.
- **No hay rollback** ni separación por entorno.

## Objetivo

Adoptar el **CLI de Supabase con migraciones versionadas** como sistema único de gestión del schema:
historial por timestamp en `schema_migrations`, `db push` para aplicar solo lo pendiente, stack local
con Docker para probar antes de tocar producción.

## Decisiones (tomadas en brainstorming)

1. **Full CLI con stack local (Docker).** El flujo completo: `supabase start` levanta Postgres+Auth
   locales; se prueban migraciones con `db reset`; se aplica a prod con `db push`.
2. **Rebaseline directo en prod, con backup previo.** No se crea un proyecto de staging. Se respalda prod,
   se corre `db pull` (introspecta y marca el historial, no altera tablas) y de ahí en adelante `db push`.
3. **Limpieza total del enfoque viejo.** Se borra `scripts/supabase-setup.mjs`, `.supabase-deploy.env` y
   su `.example`. El seed de demo en prod se hace a mano en el SQL editor del dashboard; en local,
   `seed-demo.sql` se aplica solo con `db reset`.
4. **CI ahora (GitHub Actions).** Push a `main` que toque `supabase/migrations/**` aplica las migraciones
   a prod automáticamente vía `supabase db push`.

## Alcance

**Dentro:** solo la base de datos — tablas, RLS, policies, funciones SQL. Desarrollo local con Docker. CI de migraciones.

**Fuera (lo gestiona el owner directamente en el dashboard de Supabase):**

- **Edge Functions** (`create-checkout`, `delete-user`, `lemonsqueezy-webhook`, `wompi-crear-transaccion`,
  `wompi-webhook`) — se mantienen en `supabase/functions/` **sin tocar**; ni el CLI ni el CI las despliegan.
- **Secrets** de las funciones (Wompi, etc.) — se cargan en el dashboard.

## Estado final del repositorio

| Archivo | Acción |
|---|---|
| `supabase/config.toml` | **Nuevo** (commiteado): `project_id = "gwkzcjgsuxgqejaukbse"`, seed apuntando a `./seed-demo.sql` |
| `supabase/migrations/<ts>_baseline.sql` | **Nuevo**: schema real de prod, generado por `supabase db pull` |
| `supabase/schema.sql` | **Eliminado** (su contenido pasa a vivir en el baseline) |
| `supabase/seed-demo.sql` | Se mantiene → seed **local** (se aplica en `db reset` vía `config.toml`) |
| `supabase/unseed-demo.sql` | Se mantiene como helper manual (SQL editor) |
| `scripts/supabase-setup.mjs` | **Eliminado** |
| `.supabase-deploy.env`, `.supabase-deploy.env.example` | **Eliminados** |
| `package.json` | Quitar script `supa:setup`; agregar `supabase` como **devDependency** + scripts `db:*` |
| `.gitignore` | Agregar `supabase/.temp/` y `supabase/.branches/`; quitar la línea de `.supabase-deploy.env` |
| `.github/workflows/db-migrations.yml` | **Nuevo**: en push a `main` (paths `supabase/migrations/**`) → `db push` |
| `CLAUDE.md` | Reescribir la sección **Supabase** (schema.sql/supa:setup → migraciones CLI) |
| `docs/ONBOARDING.md` | Agregar setup del CLI + Docker + `supabase start` al flujo de dev |

### Scripts de `package.json` (nuevos)

Se agrega `supabase` como devDependency (pinnea la versión del CLI, funciona en Windows y Mac sin
instalación global). Atajos:

```jsonc
"db:start": "supabase start",       // levanta el stack local (Docker)
"db:stop":  "supabase stop",
"db:new":   "supabase migration new",
"db:reset": "supabase db reset",    // re-aplica TODAS las migraciones + seed en local
"db:diff":  "supabase db diff",     // autogenera una migración desde cambios locales
"db:push":  "supabase db push",     // aplica lo pendiente al remoto (prod)
"db:pull":  "supabase db pull"      // introspecta el remoto (uso puntual)
```

## Flujo de trabajo nuevo (día a día)

1. `pnpm db:start` — Docker levanta Postgres+Auth locales.
2. `pnpm db:new nombre_cambio` — crea `supabase/migrations/<ts>_nombre_cambio.sql` vacío; se escribe el
   `ALTER`/`CREATE`/`DROP`. (Alternativa: cambiar el schema local y `pnpm db:diff -f nombre_cambio`.)
3. `pnpm db:reset` — re-aplica todas las migraciones + `seed-demo.sql` en local para probar.
4. Commit → PR → merge a `main` → **CI corre `db push`** y aplica lo pendiente a prod.

**Regla de oro:** no hay staging, así que **probar siempre con `db:reset` local antes de mergear**.
`db reset` es destructivo y **solo** para la base local — nunca contra prod.

## Rebaseline (una sola vez — el paso delicado)

1. **Backup de prod** completo (`supabase db dump` + confirmar snapshot en el dashboard) antes de nada.
2. `supabase init` (crea `config.toml`) + `supabase link --project-ref gwkzcjgsuxgqejaukbse` (pide DB password).
3. `supabase db pull` — genera la migración **baseline** desde el estado real de prod **y la marca como
   aplicada** en el historial de prod (`supabase_migrations.schema_migrations`). Por eso el primer
   `db push` de CI no intenta recrear las tablas existentes → no rompe.
4. **Verificar**: `supabase migration list` debe mostrar el baseline como aplicado en remoto. Si no,
   `supabase migration repair --status applied <version>`. Comparar el baseline generado vs `schema.sql`
   para detectar drift (idealmente equivalentes; si difieren, gana prod porque es la verdad autoritativa).
5. Recién ahí: borrar `schema.sql` + script + `.env(.example)`, configurar CI, actualizar docs.

## CI (GitHub Actions)

- Workflow `.github/workflows/db-migrations.yml`.
- **Trigger:** `push` a `main` con cambios en `supabase/migrations/**` (y en `supabase/config.toml`).
- **Pasos:** `actions/checkout` → `supabase/setup-cli@v1` → `supabase link --project-ref …` →
  `supabase db push`.
- **Secrets del repo** (los carga el owner en GitHub → Settings → Secrets and variables → Actions):
  - `SUPABASE_ACCESS_TOKEN` — token de cuenta (Account → Access Tokens).
  - `SUPABASE_DB_PASSWORD` — password de la base (para `link`/`push`).
  - El project ref va en `config.toml` (público, no secreto).
- Cada merge a `main` impacta prod (no hay staging) → el gate de calidad es la prueba local con `db:reset`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `db push` intenta recrear tablas existentes | `db pull` marca el baseline como aplicado en prod (paso 3–4) |
| `db reset` accidental contra prod (destructivo) | `reset` es solo local; CI solo hace `push`, nunca `reset`; documentado en CLAUDE.md/ONBOARDING |
| Pérdida del CA-pinning custom de `supa:setup` | Aceptado — el CLI usa TLS verificado estándar (no es inseguro, sí un downgrade del pin extra) |
| Drift entre `schema.sql` y el estado real de prod | El baseline sale de `db pull` (prod = verdad); el diff del paso 4 lo detecta antes de borrar `schema.sql` |
| Pérdida de datos durante el rebaseline | Backup completo del paso 1 antes de tocar nada |
| Secret (`SUPABASE_DB_PASSWORD`) en CI | Guardado como GitHub Secret (encriptado), nunca en el repo; se puede rotar en el dashboard |

## Verificación (no hay test suite formal en el repo)

- **Local:** `pnpm db:reset` corre limpio (todas las migraciones + seed) sin errores.
- **Baseline:** `supabase migration list` muestra el baseline como aplicado en remoto (no pendiente).
- **CI end-to-end:** el primer push tras el baseline debe ser **no-op** (nada pendiente). Un 2º PR trivial
  (ej. `COMMENT ON TABLE …`) confirma que el ciclo migración→merge→`db push`→prod funciona.
- **App:** `pnpm lint` verde y la app sigue levantando en modo demo y en modo real (Supabase configurado).

## Requisitos nuevos para el equipo

- **Docker Desktop** instalado en cada máquina de desarrollo (owner en Windows, otro dev en Mac) —
  necesario para `supabase start` y `supabase db diff`.
- Los devs corren `supabase login` (o exportan `SUPABASE_ACCESS_TOKEN`) una vez para operaciones contra el remoto.

## Alternativas consideradas y descartadas

- **Declarative schemas del CLI** (mantener un archivo declarativo + `db diff` que genera la migración,
  parecido al `schema.sql` idempotente actual): descartado por ahora para no sumar complejidad;
  las migraciones imperativas son el flujo estándar y más predecible. Queda como opción futura.
- **Enfoque híbrido** (CLI solo para schema, conservar `supa:setup` para functions/secrets): descartado —
  el owner gestionará functions y secrets directamente en el dashboard, así que el script queda sin uso.
- **Staging antes de prod**: descartado por el owner a favor de "directo en prod con backup"; el gate de
  seguridad pasa a ser la prueba local con `db:reset`.
