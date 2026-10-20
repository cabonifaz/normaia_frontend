# Norma IA · Frontend

React 19 + TypeScript (strict) + Vite. Consume el backend RAG por REST.
Diseño replicado 1:1 del prototipo de Claude Design (`src/styles/design.css`).

## Ramas y entornos

| Rama      | Entorno        | Build                  | Variables                     |
|-----------|----------------|------------------------|-------------------------------|
| `staging` | Staging        | `npm run build:staging`| `.env.staging` (no versionado)|
| `preprod` | Pre-producción | `npm run build:preprod`| `.env.preprod` (no versionado)|
| `prod`    | Producción     | `npm run build:prod`   | `.env.production` (no versionado) |

Flujo de promoción: `feature/*` → `staging` → `preprod` → `prod`, siempre por PR.
Las variables viven en el gestor de secretos del pipeline; ver `.env.example`.
Fuera de `vite dev`, cualquier build exige API por HTTPS y cifrado de campos sensibles activo (falla al arrancar si no).

## Comandos

```bash
npm ci
npm run dev          # http://localhost:5173 (requiere .env.local)
npm run verify       # typecheck + lint + unit + e2e (Playwright) + audit
```

## Seguridad (resumen)

- **Sesión:** cookie `HttpOnly; Secure; SameSite=Strict` emitida por el backend. Nada en `localStorage`/`sessionStorage` (lint lo prohíbe).
- **CSRF:** double-submit `XSRF-TOKEN` → `X-XSRF-TOKEN` en métodos no seguros.
- **Cifrado de datos sensibles:** contraseña y OTP viajan como JWE compacto `RSA-OAEP-256` + `A256GCM` (WebCrypto), `kid` para rotación, RSA ≥ 3072. Defensa en profundidad sobre TLS; el backend descifra y hashea con Argon2id.
- **HTTP:** timeout, `X-Request-Id`, `Idempotency-Key`, `redirect: 'error'`, `no-referrer`, respuestas validadas con zod (contrato), mensajes de error propios (nunca los del servidor).
- **Cabeceras:** CSP estricta sin `unsafe-inline` + Trusted Types, HSTS, COOP/COEP/CORP, `frame-ancestors 'none'`. Fuente única `deploy/securityHeaders.ts`; `deploy/nginx.conf` se valida contra ella en E2E.
- **XSS:** lint prohíbe `dangerouslySetInnerHTML`, `innerHTML`, `eval`. Fuentes autoalojadas (sin CDNs de terceros).
- **Maestros:** toda opción de combo/radio viene del maestro de maestros (`GET /maestros/{grupo}`) y se valida como lista blanca.
- **Build:** sin source maps; dependencias con versión exacta; `npm audit` en `verify`.

## Pendiente de contrato del backend

`src/config/endpoints.ts`, `src/features/auth/registerApi.ts`, `src/lib/maestros/maestrosApi.ts`.
Pantallas sin diseño aún: ingreso, app RAG, legales (`src/routes.tsx`).
