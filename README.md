# Norma IA · Frontend

React 19 + TypeScript (strict) + Vite + TanStack (Query, Router, Form). Consume el backend RAG por REST.
Diseño replicado 1:1 del prototipo de Claude Design (`src/styles/design.css`).

## Arquitectura hexagonal

```
src/
  domain/          Reglas de negocio puras (validaciones, entidades). Sin React ni HTTP.
  application/     Casos de uso + puertos (interfaces): RegistroRepository, MaestrosRepository, PayloadCipher.
  infrastructure/  Adaptadores de salida: cliente REST, repositorios REST, cifrado JWE, config.
  di/              Raíz de composición: conecta puertos con adaptadores.
  ui/              Adaptador de entrada (React 19): TanStack Router, Query (maestros y mutaciones), Form.
```

Dependencias solo hacia el centro: `ui → application → domain` e `infrastructure → application → domain`.
ESLint lo hace cumplir (`no-restricted-imports` por capa): la UI no puede importar adaptadores y el dominio no puede importar React.
Los tests de casos de uso y de UI inyectan fakes de los puertos (sin `vi.mock`).

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
npm run verify       # typecheck + lint + unit (Vitest) + e2e (Playwright) + audit
```

## Seguridad (resumen)

- **Sesión:** cookie `HttpOnly; Secure; SameSite=Strict` emitida por el backend. Nada en `localStorage`/`sessionStorage` (lint lo prohíbe).
- **CSRF:** double-submit `XSRF-TOKEN` → `X-XSRF-TOKEN` en métodos no seguros.
- **Cifrado de datos sensibles:** contraseña y OTP viajan como JWE compacto `RSA-OAEP-256` + `A256GCM` (WebCrypto), `kid` para rotación, RSA ≥ 3072. Defensa en profundidad sobre TLS; el backend descifra y hashea con Argon2id.
- **HTTP:** timeout, `X-Request-Id`, `Idempotency-Key`, `redirect: 'error'`, `no-referrer`, respuestas validadas con zod (contrato), mensajes de error propios (nunca los del servidor).
- **Cabeceras:** CSP estricta sin `unsafe-inline` + Trusted Types, HSTS, COOP/COEP/CORP, `frame-ancestors 'none'`. Fuente única `deploy/securityHeaders.ts`; `deploy/nginx.conf` se valida contra ella en E2E.
- **XSS:** lint prohíbe `dangerouslySetInnerHTML`, `innerHTML`, `eval`. Fuentes autoalojadas (sin CDNs de terceros).
- **Maestros:** toda opción de combo/radio viene del maestro de maestros (`GET /maestros/{grupo}`, caché TanStack Query en memoria) y se valida como lista blanca en UI y en el caso de uso.
- **Build:** sin source maps; dependencias con versión exacta; `npm audit` en `verify`.

## Integración con backend Qamaq RAG API

Contrato: Swagger `/docs` (v1.0.0). Adaptadores en `src/infrastructure/{registro,auth,maestros}`.
En desarrollo, Vite hace de proxy de `/api` hacia `VITE_API_PROXY_TARGET` (mismo origen → sin CORS).
En producción se recomienda lo mismo con nginx (`location /api/ { proxy_pass … }`).

`npm run dev:lan` publica en la red local por HTTPS autofirmado (WebCrypto exige contexto seguro).

### Requisitos pendientes del backend (seguridad e integración)

| # | Tema | Estado actual | Requisito |
|---|------|---------------|-----------|
| 1 | `GET /company/get_companies_login` | Público, devuelve `SECRET_KEY` de todas las empresas | **Crítico:** protegerlo o eliminarlo |
| 2 | `ref` en `/auth/login` | Secret key de empresa obligatoria | Un valor en el bundle es público: resolver la empresa en servidor |
| 3 | Sesión | JWT en el cuerpo (el front lo guarda solo en memoria) | Cookie `HttpOnly; Secure; SameSite=Strict` |
| 4 | Maestros 23/24 en el registro | **Bloqueante, verificado 2026-10-20:** con el RegistroBearer responden 401 "Token inválido" | Aceptar RegistroBearer o exponer endpoint público de solo lectura |
| 5 | Respuesta de `VALIDAR` | Real: `{ esValido, tokenRegistro, expiraEnSegundos: 900 }` (no documentado) | Documentar en el Swagger. El front ya lo usa y maneja el vencimiento de 15 min |
| 6 | Recuperación de contraseña | No existe | Endpoints solicitar código / restablecer |
| 7 | CORS | Origen del front no permitido; `Retry-After` no expuesto | Lista blanca + `Access-Control-Expose-Headers: Retry-After, X-Request-Id` |
| 8 | Cifrado de campos (JWE) | Espera claves en claro | Descifrar JWE RSA-OAEP-256/A256GCM (el front ya lo soporta) |
| 9 | Cabeceras de seguridad del API | Sin HSTS/CSP/nosniff | Añadirlas |

Pantallas sin diseño aún: app RAG y legales (`src/ui/app/router.tsx`).
