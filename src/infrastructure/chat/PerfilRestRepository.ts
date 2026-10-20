import { z } from 'zod';
import type { PerfilRepository } from '@/application/ports/ChatRepository';
import type { ContextoTrabajo, UsuarioSesion } from '@/domain/chat/chat';
import type { SessionStore } from '@/infrastructure/auth/sessionStore';
import { endpoints } from '@/infrastructure/config/endpoints';
import type { HttpClient } from '@/infrastructure/http/httpClient';

/**
 * Perfil y contexto del usuario final.
 *  - Datos de presentación desde las claims del JWT (sin verificar firma: SOLO para mostrar el nombre;
 *    la autorización la hace el backend en cada llamada).
 *  - Áreas desde GET /auth/company-areas. El SECRET_KEY que trae la respuesta se descarta.
 */
const Claims = z
  .object({
    ID_USUARIO: z.number().int().positive(),
    USUARIO: z.string().max(254),
    NOMBRES: z.string().max(128).optional().default(''),
    APELLIDOS: z.string().max(128).optional().default(''),
  })
  .passthrough();

const AreasSchema = z
  .object({
    company_areas: z
      .array(z.object({ ID_EMPRESA: z.number().int(), EMPRESA: z.string().max(200), ID_AREA: z.number().int(), AREA: z.string().max(200) }).passthrough())
      .max(500),
  })
  .passthrough();

function decodeClaims(jwt: string): UsuarioSesion | null {
  try {
    const payload = jwt.split('.')[1] ?? '';
    const json = new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0)));
    const c = Claims.parse(JSON.parse(json));
    return { id: c.ID_USUARIO, correo: c.USUARIO, nombres: c.NOMBRES, apellidos: c.APELLIDOS };
  } catch {
    return null;
  }
}

export function createPerfilRestRepository(http: HttpClient, session: SessionStore): PerfilRepository {
  return {
    usuarioActual() {
      const t = session.session();
      return t ? decodeClaims(t) : null;
    },

    async contextos() {
      const { company_areas } = await http(endpoints.auth.areas, { schema: AreasSchema, bearer: session.session() });
      return company_areas.map((a): ContextoTrabajo => ({ empresaId: a.ID_EMPRESA, empresa: a.EMPRESA, areaId: a.ID_AREA, area: a.AREA }));
    },

    async cerrarSesion() {
      const usuario = this.usuarioActual();
      try {
        // Best-effort: el backend solo marca "desconectado". La sesión local se borra siempre.
        if (usuario) await http(endpoints.auth.logout, { method: 'POST', bearer: session.session(), body: { user_id: usuario.id }, schema: z.unknown(), notifyUnauthorized: false });
      } catch {
        /* sin efecto en el cierre local */
      } finally {
        session.clear();
      }
    },
  };
}
