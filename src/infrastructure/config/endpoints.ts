/**
 * Catálogo de endpoints REST del backend "Qamaq RAG API" (Swagger /docs, v1.0.0).
 * Rutas relativas a VITE_API_BASE_URL (p. ej. /api/v1).
 */
export const endpoints = {
  auth: {
    /** Valida que el dominio del correo esté habilitado (maestro 20). No envía correo. */
    validarCorreo: '/auth/validar-correo',
    /** accion=REGISTRAR envía el código; accion=VALIDAR lo verifica y devuelve el RegistroBearer. */
    verificacionCodigo: '/auth/verificacion-codigo',
    /** Crea la cuenta. Requiere RegistroBearer (no el JWT de login). */
    crearUsuario: '/auth/crear-usuario',
    /** { usuario, clave_acceso, ref } → { token }. 401 = credenciales o empresa inválidas. */
    login: '/auth/login',
    logout: '/auth/logout',
    /** Empresas/áreas del usuario (del JWT). */
    areas: '/auth/company-areas',
  },
  chats: {
    listar: '/chats/get_chats',
    porId: (id: number) => `/chats/${encodeURIComponent(String(Math.trunc(id)))}`,
    /** Paginado con ?last_evaluated_key=<JSON>. */
    mensajes: '/messages/chat',
    urlsAdjuntos: '/messages/attachment-upload-urls',
  },
  rag: {
    chat: '/rag/chat-streaming',
    /** Con imágenes adjuntas (VLM). */
    vlm: '/rag/vlm-streaming',
  },
  parametros: {
    /** Maestro de maestros por grupo (GRP_ID_MAESTRO). Requiere Bearer. */
    porMaestro: '/parametros/get_param_by_id_maestro',
  },
} as const;
