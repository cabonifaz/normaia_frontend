import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { userMessage } from '@/application/errors';
import { LIMITES, tituloVisible, type Chat, type ContextoTrabajo } from '@/domain/chat/chat';
import { useDependencies } from '@/ui/app/DependenciesContext';
import { ConfirmDialog } from './ConfirmDialog';
import { keys } from './useChatData';

interface ChatSidebarProps {
  contexto: ContextoTrabajo;
  chats: Chat[] | undefined;
  cargando: boolean;
  fallo: boolean;
  activo: number | null;
  bloqueado: boolean;
  onSeleccionar: (id: number) => void;
  onNuevo: () => void;
  /** Logo: vuelve al home del chat sin salir de la sesión. */
  onInicio: () => void;
  onCerrar: () => void;
  onEliminado: (id: number) => void;
  onReintentar: () => void;
}

export function ChatSidebar(props: ChatSidebarProps) {
  const { contexto, chats, cargando, fallo, activo, bloqueado, onSeleccionar, onNuevo, onInicio, onCerrar, onEliminado, onReintentar } = props;
  const { chat } = useDependencies();
  const qc = useQueryClient();
  const [menu, setMenu] = useState<number | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [borrar, setBorrar] = useState<Chat | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const key = keys.chats(contexto.areaId);

  const renombrar = useMutation({
    mutationFn: ({ id, titulo }: { id: number; titulo: string }) => chat.renombrar(id, titulo),
    onMutate: async ({ id, titulo }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Chat[]>(key);
      qc.setQueryData<Chat[]>(key, (old) => old?.map((c) => (c.id === id ? { ...c, titulo } : c)));
      return { prev };
    },
    onError: (err, _v, ctx) => {
      qc.setQueryData(key, ctx?.prev);
      setAviso(userMessage(err, { validation: 'El título no puede quedar vacío.' }));
    },
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => chat.eliminar(id),
    onSuccess: (_r, id) => {
      qc.setQueryData<Chat[]>(key, (old) => old?.filter((c) => c.id !== id));
      qc.removeQueries({ queryKey: keys.mensajes(contexto.areaId, id) });
      setBorrar(null);
      onEliminado(id);
    },
    onError: (err) => {
      setBorrar(null);
      setAviso(userMessage(err));
    },
  });

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <aside className="app-side" aria-label="Conversaciones">
      <div className="app-side-top">
        <button className="logo logo-btn" type="button" aria-label="Norma IA, inicio de consultas" onClick={onInicio} disabled={bloqueado}>
          <svg aria-hidden="true">
            <use href="#isotipo" />
          </svg>
          <span>NORMA IA</span>
        </button>
        <button className="side-close" type="button" aria-label="Cerrar panel de conversaciones" onClick={onCerrar}>✕</button>
      </div>
      <button className="btn new-chat" type="button" onClick={onNuevo} disabled={bloqueado}>Nueva consulta</button>
      <p className="side-label" id="side-label">Historial</p>
      {aviso && <p className="side-status" role="alert">{aviso}</p>}

      {cargando ? (
        <div aria-busy="true" aria-label="Cargando conversaciones">
          <div className="side-skel" />
          <div className="side-skel" />
          <div className="side-skel" />
        </div>
      ) : fallo ? (
        <p className="side-status" role="alert">
          No pudimos cargar tu historial.{' '}
          <button className="btn btn--text" type="button" onClick={onReintentar}>Reintentar</button>
        </p>
      ) : !chats?.length ? (
        <p className="side-empty">Aún no tienes consultas. Empieza una nueva.</p>
      ) : (
        <ul className="chat-list" aria-labelledby="side-label">
          {chats.map((c) => (
            <ChatRow
              key={c.id}
              chat={c}
              activo={c.id === activo}
              bloqueado={bloqueado}
              menuAbierto={menu === c.id}
              editando={editando === c.id}
              onAbrir={() => {
                setMenu(null);
                onSeleccionar(c.id);
              }}
              onMenu={(abrir) => setMenu(abrir ? c.id : null)}
              onRenombrar={() => {
                setMenu(null);
                setEditando(c.id);
              }}
              onEliminar={() => {
                setMenu(null);
                setBorrar(c);
              }}
              onGuardar={(titulo) => {
                setEditando(null);
                if (titulo && titulo !== c.titulo) renombrar.mutate({ id: c.id, titulo });
              }}
              onCancelar={() => setEditando(null)}
            />
          ))}
        </ul>
      )}

      <p className="side-foot">Norma IA orienta. La decisión es tuya.</p>

      <ConfirmDialog
        open={!!borrar}
        title="¿Eliminar esta consulta?"
        body={borrar ? `Se eliminará “${tituloVisible(borrar)}” de tu historial. Esta acción no se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        pending={eliminar.isPending}
        onConfirm={() => borrar && eliminar.mutate(borrar.id)}
        onClose={() => setBorrar(null)}
      />
    </aside>
  );
}

interface ChatRowProps {
  chat: Chat;
  activo: boolean;
  bloqueado: boolean;
  menuAbierto: boolean;
  editando: boolean;
  onAbrir: () => void;
  onMenu: (abrir: boolean) => void;
  onRenombrar: () => void;
  onEliminar: () => void;
  onGuardar: (titulo: string) => void;
  onCancelar: () => void;
}

function ChatRow({ chat, activo, bloqueado, menuAbierto, editando, onAbrir, onMenu, onRenombrar, onEliminar, onGuardar, onCancelar }: ChatRowProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resuelto = useRef(false); // Enter y el blur posterior no deben guardar dos veces
  const titulo = tituloVisible(chat);

  useEffect(() => {
    if (editando) {
      resuelto.current = false;
      inputRef.current?.select();
    }
  }, [editando]);

  useEffect(() => {
    if (!menuAbierto) return;
    menuRef.current?.querySelector('button')?.focus();
    const fuera = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && e.target !== moreRef.current) onMenu(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [menuAbierto, onMenu]);

  const navMenu = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuRef.current?.querySelectorAll('button') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      onMenu(false);
      moreRef.current?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === 'Tab') onMenu(false);
  };

  if (editando) {
    return (
      <li className="chat-item">
        <input
          ref={inputRef}
          className="chat-rename"
          aria-label="Nuevo título de la consulta"
          defaultValue={chat.titulo}
          maxLength={LIMITES.titulo}
          onKeyDown={(e) => {
            if (resuelto.current) return;
            if (e.key === 'Enter') {
              resuelto.current = true;
              onGuardar(e.currentTarget.value.trim());
            }
            if (e.key === 'Escape') {
              resuelto.current = true;
              onCancelar();
            }
          }}
          onBlur={(e) => {
            if (resuelto.current) return;
            resuelto.current = true;
            onGuardar(e.currentTarget.value.trim());
          }}
        />
      </li>
    );
  }

  return (
    <li className="chat-item" aria-current={activo || undefined}>
      <button className="chat-open" type="button" onClick={onAbrir} disabled={bloqueado && !activo} title={titulo}>
        <span>{titulo}</span>
      </button>
      <button
        ref={moreRef}
        className="chat-more"
        type="button"
        aria-label={`Opciones de “${titulo}”`}
        aria-haspopup="menu"
        aria-expanded={menuAbierto}
        disabled={bloqueado}
        onClick={() => onMenu(!menuAbierto)}
      >
        <svg width="16" height="4" viewBox="0 0 16 4" aria-hidden="true" fill="currentColor">
          <rect width="4" height="4" />
          <rect x="6" width="4" height="4" />
          <rect x="12" width="4" height="4" />
        </svg>
      </button>
      {menuAbierto && (
        <div className="chat-menu" role="menu" aria-label={`Opciones de “${titulo}”`} ref={menuRef} onKeyDown={navMenu}>
          <button type="button" role="menuitem" onClick={onRenombrar}>Renombrar</button>
          <button type="button" role="menuitem" className="danger" onClick={onEliminar}>Eliminar</button>
        </div>
      )}
    </li>
  );
}
