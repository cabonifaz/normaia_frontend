import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError, userMessage } from '@/application/errors';
import type { ArchivoAdjunto, PaginaMensajes } from '@/application/ports/ChatRepository';
import { acumularTexto, ordenarChats, type Chat, type ContextoTrabajo, type Mensaje } from '@/domain/chat/chat';
import { useDependencies } from '@/ui/app/DependenciesContext';

export const keys = {
  contextos: ['perfil', 'contextos'] as const,
  chats: (areaId: number) => ['chats', areaId] as const,
  mensajes: (areaId: number, chatId: number) => ['mensajes', areaId, chatId] as const,
};

type Paginas = InfiniteData<PaginaMensajes, string | null>;

export function useContexto() {
  const { chat } = useDependencies();
  return useQuery({ queryKey: keys.contextos, queryFn: () => chat.contextos(), staleTime: Infinity });
}

export function useChats(contexto: ContextoTrabajo | null) {
  const { chat } = useDependencies();
  return useQuery({
    queryKey: keys.chats(contexto?.areaId ?? 0),
    queryFn: () => (contexto ? chat.listarChats(contexto) : Promise.resolve([])),
    enabled: !!contexto,
    staleTime: 60_000,
  });
}

export function useMensajes(contexto: ContextoTrabajo | null, chatId: number | null) {
  const { chat } = useDependencies();
  const q = useInfiniteQuery({
    queryKey: keys.mensajes(contexto?.areaId ?? 0, chatId ?? 0),
    queryFn: ({ pageParam }) => {
      if (!contexto || chatId === null) return Promise.resolve({ mensajes: [], cursor: null });
      return chat.mensajes(chatId, contexto, pageParam);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.cursor,
    enabled: !!contexto && chatId !== null,
    // Solo este cliente escribe en sus chats: la caché local es la verdad durante la sesión.
    staleTime: Infinity,
  });
  // Página 0 = la más reciente; se muestran en orden cronológico.
  const mensajes = q.data ? [...q.data.pages].reverse().flatMap((p) => p.mensajes) : [];
  return { ...q, mensajes };
}

export interface Borrador {
  usuario: Mensaje;
  asistente: Mensaje | null;
}

interface EstadoConsulta {
  activo: boolean;
  progreso: string | null;
  borrador: Borrador | null;
  error: { mensaje: string; reintento: { texto: string; archivos: ArchivoAdjunto[] } } | null;
  detenido: boolean;
}

const INICIAL: EstadoConsulta = { activo: false, progreso: null, borrador: null, error: null, detenido: false };

export function useConsulta(contexto: ContextoTrabajo | null, chatId: number | null, onChatAsignado: (id: number) => void) {
  const { chat } = useDependencies();
  const qc = useQueryClient();
  const [estado, setEstado] = useState<EstadoConsulta>(INICIAL);
  const ctrl = useRef<AbortController | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const detener = useCallback(() => ctrl.current?.abort(), []);
  const limpiarError = useCallback(() => setEstado((s) => ({ ...s, error: null, detenido: false })), []);

  const enviar = useCallback(
    async (texto: string, archivos: ArchivoAdjunto[]) => {
      if (!contexto || ctrl.current) return;
      const controller = new AbortController();
      ctrl.current = controller;
      const areaId = contexto.areaId;
      let id = chatId;
      let acumulado = '';
      const ahora = Date.now();
      const usuario: Mensaje = {
        id: `local-u-${ahora}`,
        remitente: 'usuario',
        texto,
        creadoEn: ahora,
        adjuntos: archivos.map((a) => URL.createObjectURL(a.contenido)),
      };
      let asistente: Mensaje | null = null;
      setEstado({ activo: true, progreso: null, borrador: { usuario, asistente: null }, error: null, detenido: false });

      const pintar = () => {
        if (raf.current !== null) return;
        raf.current = requestAnimationFrame(() => {
          raf.current = null;
          setEstado((s) => (s.borrador?.asistente ? { ...s, borrador: { ...s.borrador, asistente: { ...s.borrador.asistente, texto: acumulado } } } : s));
        });
      };

      const confirmar = (final: Mensaje | null) => {
        if (id === null) return;
        const nuevos = final ? [usuario, final] : [usuario];
        qc.setQueryData<Paginas>(keys.mensajes(areaId, id), (old) => {
          if (!old) return { pages: [{ mensajes: nuevos, cursor: null }], pageParams: [null] };
          const [primera, ...resto] = old.pages;
          if (!primera) return { pages: [{ mensajes: nuevos, cursor: null }], pageParams: [null] };
          return { ...old, pages: [{ ...primera, mensajes: [...primera.mensajes, ...nuevos] }, ...resto] };
        });
        qc.setQueryData<Chat[]>(keys.chats(areaId), (old) =>
          old ? ordenarChats(old.map((c) => (c.id === id ? { ...c, ultimoMensaje: Date.now() } : c))) : old,
        );
      };

      try {
        for await (const ev of chat.consultar({ texto, chatId, contexto, archivos }, controller.signal)) {
          switch (ev.tipo) {
            case 'progreso':
              setEstado((s) => ({ ...s, progreso: ev.texto }));
              break;
            case 'chat-asignado':
              if (id === null) {
                id = ev.chatId;
                qc.setQueryData<Paginas>(keys.mensajes(areaId, id), { pages: [{ mensajes: [], cursor: null }], pageParams: [null] });
                onChatAsignado(id);
              }
              break;
            case 'chat-creado':
              qc.setQueryData<Chat[]>(keys.chats(areaId), (old) => (old?.some((c) => c.id === ev.chat.id) ? old : [ev.chat, ...(old ?? [])]));
              break;
            case 'inicio-respuesta':
              asistente = { id: `local-a-${ev.creadoEn}`, remitente: 'asistente', texto: '', creadoEn: ev.creadoEn, adjuntos: [] };
              setEstado((s) => ({ ...s, borrador: { usuario, asistente } }));
              break;
            case 'texto':
              if (!asistente) {
                asistente = { id: `local-a-${Date.now()}`, remitente: 'asistente', texto: '', creadoEn: Date.now(), adjuntos: [] };
                setEstado((s) => ({ ...s, borrador: { usuario, asistente } }));
              }
              acumulado = acumularTexto(acumulado, ev.contenido);
              pintar();
              break;
            case 'error':
              throw new AppError('server', 200, 'stream');
            case 'fin':
              break;
          }
        }
        confirmar(asistente ? { ...asistente, texto: acumulado } : null);
        setEstado(INICIAL);
      } catch (err) {
        const abortado = err instanceof AppError && err.kind === 'aborted';
        if (abortado) {
          // Detenido por el usuario: se conserva lo recibido.
          confirmar(acumulado && asistente ? { ...asistente, texto: acumulado } : null);
          setEstado({ ...INICIAL, detenido: true });
        } else {
          setEstado({
            ...INICIAL,
            borrador: { usuario, asistente: acumulado && asistente ? { ...asistente, texto: acumulado } : null },
            error: { mensaje: userMessage(err, { server: 'No pudimos completar la respuesta. Inténtalo de nuevo.' }), reintento: { texto, archivos } },
          });
        }
      } finally {
        if (raf.current !== null) cancelAnimationFrame(raf.current);
        raf.current = null;
        ctrl.current = null;
      }
    },
    [chat, chatId, contexto, onChatAsignado, qc],
  );

  return { ...estado, enviar, detener, limpiarError };
}
