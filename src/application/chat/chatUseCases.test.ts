import { describe, expect, it, vi } from 'vitest';
import type { ChatRepository, PerfilRepository } from '@/application/ports/ChatRepository';
import type { EventoChat } from '@/domain/chat/chat';
import { createChatUseCases } from './chatUseCases';

const CTX = { empresaId: 1, empresa: 'NORMA', areaId: 7, area: 'GENERAL' };
const PNG = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], { type: 'image/png' });

function setup(usuario = true) {
  const chats = {
    listarChats: vi.fn<ChatRepository['listarChats']>().mockResolvedValue([
      { id: 1, titulo: 'a', empresaId: 1, areaId: 7, ultimoMensaje: 10 },
      { id: 2, titulo: 'b', empresaId: 1, areaId: 99, ultimoMensaje: 20 },
      { id: 3, titulo: 'c', empresaId: 1, areaId: 7, ultimoMensaje: 30 },
    ]),
    mensajes: vi.fn<ChatRepository['mensajes']>(),
    renombrar: vi.fn<ChatRepository['renombrar']>().mockResolvedValue(),
    eliminar: vi.fn<ChatRepository['eliminar']>().mockResolvedValue(),
    subirAdjuntos: vi.fn<ChatRepository['subirAdjuntos']>().mockResolvedValue({ nombres: ['plano-1.png'], marca: '123' }),
    consultar: vi.fn<ChatRepository['consultar']>(async function* (): AsyncGenerator<EventoChat> {
      yield { tipo: 'fin' };
    }),
  } satisfies ChatRepository;
  const perfil: PerfilRepository = {
    usuarioActual: () => (usuario ? { id: 5, correo: 'a@b.pe', nombres: 'Ana', apellidos: 'Q' } : null),
    contextos: vi.fn(),
    cerrarSesion: vi.fn(),
  };
  return { chats, uc: createChatUseCases({ chats, perfil }) };
}

const drain = async (it: AsyncIterable<unknown>) => {
  for await (const _ of it) void _;
};

describe('casos de uso del chat', () => {
  it('solo muestra los chats del área activa, del más reciente al más antiguo', async () => {
    const { uc } = setup();
    expect((await uc.listarChats(CTX)).map((c) => c.id)).toEqual([3, 1]);
  });

  it('renombrar normaliza y rechaza vacíos', async () => {
    const { uc, chats } = setup();
    await expect(uc.renombrar(1, '  Nuevo   título ')).resolves.toBe('Nuevo título');
    expect(chats.renombrar).toHaveBeenCalledWith(1, 'Nuevo título');
    await expect(uc.renombrar(1, '   ')).rejects.toMatchObject({ kind: 'validation' });
  });

  it('consulta con el usuario de la sesión y texto normalizado', async () => {
    const { uc, chats } = setup();
    await drain(uc.consultar({ texto: '  ¿A.130?\u0000 ', chatId: null, contexto: CTX, archivos: [] }, new AbortController().signal));
    expect(chats.consultar).toHaveBeenCalledWith(expect.objectContaining({ texto: '¿A.130?', usuarioId: 5, adjuntos: null, chatId: null }), expect.any(AbortSignal));
  });

  it('sin sesión no consulta', async () => {
    const { uc, chats } = setup(false);
    await expect(drain(uc.consultar({ texto: 'hola', chatId: null, contexto: CTX, archivos: [] }, new AbortController().signal))).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(chats.consultar).not.toHaveBeenCalled();
  });

  it('sube adjuntos con nombre seguro antes de consultar', async () => {
    const { uc, chats } = setup();
    await drain(uc.consultar({ texto: 'Revisa este plano', chatId: 3, contexto: CTX, archivos: [{ nombre: '../Plano Ñ.png', tipo: 'image/png', contenido: PNG }] }, new AbortController().signal));
    expect(chats.subirAdjuntos).toHaveBeenCalledWith(CTX, [expect.objectContaining({ nombre: 'Plano-N-1.png' })]);
    expect(chats.consultar).toHaveBeenCalledWith(expect.objectContaining({ adjuntos: { nombres: ['plano-1.png'], marca: '123' } }), expect.any(AbortSignal));
  });

  it('rechaza un archivo disfrazado de imagen (firma binaria)', async () => {
    const { uc, chats } = setup();
    const falso = new Blob(['<svg onload=alert(1)>'], { type: 'image/png' });
    await expect(
      drain(uc.consultar({ texto: 'x', chatId: null, contexto: CTX, archivos: [{ nombre: 'a.png', tipo: 'image/png', contenido: falso }] }, new AbortController().signal)),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(chats.subirAdjuntos).not.toHaveBeenCalled();
  });
});
