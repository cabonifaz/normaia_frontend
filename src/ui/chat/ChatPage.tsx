import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { tituloVisible } from '@/domain/chat/chat';
import { useDependencies } from '@/ui/app/DependenciesContext';
import { ChatSidebar } from './ChatSidebar';
import { Composer, type ComposerHandle } from './Composer';
import { Thread } from './Thread';
import { useChats, useConsulta, useContexto, useMensajes } from './useChatData';
import { UserMenu } from './UserMenu';
import { Welcome } from './Welcome';

/** Pantalla post-login del usuario final: historial de consultas + chat RAG con streaming. */
export function ChatPage() {
  const { chat } = useDependencies();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const usuario = chat.usuarioActual();
  const composer = useRef<ComposerHandle>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);

  const ctx = useContexto();
  const contexto = ctx.data?.[0] ?? null; // usuario final: su área asignada (sin selector)
  const chats = useChats(contexto);
  const [chatId, setChatId] = useState<number | null>(null);
  const [panel, setPanel] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const mensajes = useMensajes(contexto, chatId);

  const onChatAsignado = useCallback((id: number) => setChatId(id), []);
  const consulta = useConsulta(contexto, chatId, onChatAsignado);

  const actual = chats.data?.find((c) => c.id === chatId) ?? null;
  const titulo = chatId === null ? 'Nueva consulta' : actual ? tituloVisible(actual) : 'Consulta';

  useEffect(() => {
    document.title = `${titulo} · Norma IA`;
  }, [titulo]);

  // Panel móvil: Escape cierra y el foco vuelve al botón que lo abrió.
  useEffect(() => {
    if (!panel) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanel(false);
        menuBtn.current?.focus();
      }
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [panel]);

  const abrirChat = (id: number | null) => {
    if (consulta.activo) return;
    consulta.limpiarError();
    setChatId(id);
    setPanel(false);
    requestAnimationFrame(() => composer.current?.focus());
  };

  const salir = async () => {
    setSaliendo(true);
    consulta.detener();
    await chat.cerrarSesion();
    qc.clear(); // nada de la conversación queda en memoria
    await navigate({ to: '/ingresar', search: { motivo: 'sesion-cerrada' }, replace: true });
  };

  if (ctx.isPending) {
    return (
      <div className="app-state" role="status">
        <span className="nodes" aria-hidden="true"><i /><i /><i /></span>
        <p>Preparando tu espacio de consulta…</p>
      </div>
    );
  }

  if (ctx.isError || !contexto) {
    return (
      <div className="app-state">
        <h2 className="display">{ctx.isError ? 'No pudimos cargar tu cuenta' : 'Tu cuenta aún no tiene un área de consulta'}</h2>
        <p className="muted">
          {ctx.isError
            ? 'Revisa tu conexión e inténtalo de nuevo.'
            : 'Para consultar el reglamento, tu usuario necesita un área asignada. Comunícate con soporte para habilitarla.'}
        </p>
        <div className="confirm-actions">
          {ctx.isError && <button className="btn" type="button" onClick={() => void ctx.refetch()}>Reintentar</button>}
          <button className="btn btn--ghost" type="button" onClick={() => void salir()} disabled={saliendo}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  const borrador = consulta.borrador;
  const vacio = chatId === null && !borrador && !consulta.activo;
  const lista = [...mensajes.mensajes, ...(borrador ? [borrador.usuario] : [])];
  const enviar = (texto: string, archivos: Parameters<typeof consulta.enviar>[1]) => void consulta.enviar(texto, archivos);

  return (
    <div className="app" data-side={panel ? 'open' : 'closed'}>
      <ChatSidebar
        contexto={contexto}
        chats={chats.data}
        cargando={chats.isPending}
        fallo={chats.isError}
        activo={chatId}
        bloqueado={consulta.activo}
        onSeleccionar={(id) => abrirChat(id)}
        onNuevo={() => abrirChat(null)}
        onCerrar={() => {
          setPanel(false);
          menuBtn.current?.focus();
        }}
        onEliminado={(id) => id === chatId && abrirChat(null)}
        onReintentar={() => void chats.refetch()}
      />
      <button className="app-scrim" type="button" tabIndex={-1} aria-hidden="true" onClick={() => setPanel(false)} />

      <main className="app-main" aria-labelledby="chat-title">
        <header className="app-top">
          <button ref={menuBtn} className="menu-btn" type="button" aria-label="Abrir historial de consultas" aria-expanded={panel} onClick={() => setPanel(true)}>
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true" fill="currentColor">
              <rect width="18" height="2" />
              <rect y="6" width="18" height="2" />
              <rect y="12" width="18" height="2" />
            </svg>
          </button>
          <div className="app-top-title">
            <h1 id="chat-title">{titulo}</h1>
            <span className="ctx">{contexto.empresa} · {contexto.area}</span>
          </div>
          {chatId !== null && (
            <button className="btn btn--ghost top-new" type="button" onClick={() => abrirChat(null)} disabled={consulta.activo}>
              + Nueva
            </button>
          )}
          <UserMenu usuario={usuario} onSalir={() => void salir()} saliendo={saliendo} />
        </header>

        {vacio ? (
          <div className="thread">
            <Welcome nombre={usuario?.nombres ?? ''} disabled={consulta.activo} onPregunta={(t) => enviar(t, [])} />
          </div>
        ) : mensajes.isError ? (
          <div className="app-state">
            <h2 className="display">No pudimos cargar esta consulta</h2>
            <button className="btn" type="button" onClick={() => void mensajes.refetch()}>Reintentar</button>
          </div>
        ) : chatId !== null && mensajes.isPending && !borrador ? (
          <div className="app-state" role="status">
            <span className="nodes" aria-hidden="true"><i /><i /><i /></span>
            <p>Cargando conversación…</p>
          </div>
        ) : (
          <Thread
            mensajes={lista}
            enCurso={borrador?.asistente ?? null}
            progreso={consulta.progreso}
            activo={consulta.activo}
            hayAnteriores={!!mensajes.hasNextPage}
            cargandoAnteriores={mensajes.isFetchingNextPage}
            onAnteriores={() => void mensajes.fetchNextPage()}
            extra={
              consulta.error ? (
                <div className="msg-error" role="alert">
                  <p className="error">{consulta.error.mensaje}</p>
                  <button className="btn btn--ghost" type="button" onClick={() => consulta.error && enviar(consulta.error.reintento.texto, consulta.error.reintento.archivos)}>
                    Reintentar
                  </button>
                </div>
              ) : consulta.detenido ? (
                <p className="muted" role="status">Respuesta detenida.</p>
              ) : null
            }
          />
        )}

        <span className="sr-only" aria-live="polite">{consulta.activo ? 'Norma IA está respondiendo.' : ''}</span>

        <Composer
          ref={composer}
          disabled={false}
          enviando={consulta.activo}
          placeholder="Pregunta sobre el Reglamento Nacional de Edificaciones…"
          onEnviar={enviar}
          onDetener={consulta.detener}
        />
      </main>
    </div>
  );
}
