import { describe, expect, it } from 'vitest';
import {
  acumularTexto,
  CODIGO_NORMA,
  firmaImagenValida,
  LIMITES,
  MSG_CHAT,
  nombreSeguro,
  normalizarMensaje,
  normalizarTitulo,
  ordenarChats,
  tituloVisible,
  validarAdjuntos,
  validarMensaje,
} from './chat';

describe('dominio del chat', () => {
  it('valida y normaliza el mensaje', () => {
    expect(validarMensaje('   ')).toBe(MSG_CHAT.vacio);
    expect(validarMensaje('a'.repeat(LIMITES.mensaje + 1))).toBe(MSG_CHAT.largo);
    expect(validarMensaje('¿Qué exige la A.130?')).toBeNull();
    expect(normalizarMensaje('  hola\u0000\u0007 mundo\r\n ')).toBe('hola mundo');
  });

  it('acumula el streaming sin duplicar (acumulado o deltas)', () => {
    // Backend Qamaq: cada chunk trae el texto acumulado
    expect(['Según', 'Según la', 'Según la A.130'].reduce(acumularTexto, '')).toBe('Según la A.130');
    // Si algún día envía deltas, también funciona
    expect(['Según', ' la', ' A.130'].reduce(acumularTexto, '')).toBe('Según la A.130');
  });

  it('títulos: limpia, recorta y muestra un fallback', () => {
    expect(normalizarTitulo('  Salidas \n de   evacuación  ')).toBe('Salidas de evacuación');
    expect(normalizarTitulo('x'.repeat(80))).toHaveLength(LIMITES.titulo);
    expect(tituloVisible({ id: 7, titulo: '  ' })).toBe('Consulta #7');
  });

  it('ordena el historial por último mensaje (sin fecha al final)', () => {
    const r = ordenarChats([
      { id: 1, titulo: '', empresaId: 1, areaId: 1, ultimoMensaje: null },
      { id: 2, titulo: '', empresaId: 1, areaId: 1, ultimoMensaje: 50 },
      { id: 3, titulo: '', empresaId: 1, areaId: 1, ultimoMensaje: 90 },
    ]);
    expect(r.map((c) => c.id)).toEqual([3, 2, 1]);
  });

  it('adjuntos: tipo, peso y cantidad', () => {
    const ok = { nombre: 'plano.png', tipo: 'image/png', peso: 1000 };
    expect(validarAdjuntos(0, [ok])).toBeNull();
    expect(validarAdjuntos(0, [{ ...ok, tipo: 'application/pdf' }])).toBe(MSG_CHAT.adjuntoTipo);
    expect(validarAdjuntos(0, [{ ...ok, tipo: 'image/svg+xml' }])).toBe(MSG_CHAT.adjuntoTipo); // SVG puede contener scripts
    expect(validarAdjuntos(0, [{ ...ok, peso: LIMITES.pesoAdjunto + 1 }])).toBe(MSG_CHAT.adjuntoPeso);
    expect(validarAdjuntos(4, [ok, ok])).toBe(MSG_CHAT.adjuntoMax);
  });

  it('firma binaria: acepta PNG/JPG/WEBP reales y rechaza disfraces', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
    const html = new TextEncoder().encode('<script>x</s');
    expect([png, jpg, webp].every(firmaImagenValida)).toBe(true);
    expect(firmaImagenValida(html)).toBe(false);
  });

  it('nombre seguro para el almacenamiento (sin rutas ni caracteres raros)', () => {
    expect(nombreSeguro('../../etc/Plano Ñaña final.PNG', 0)).toBe('etc-Plano-Nana-final-1.png');
    expect(nombreSeguro('<img onerror=x>.jpg', 2)).toBe('img-onerror-x-3.jpg');
    expect(nombreSeguro('.webp', 0)).toBe('imagen-1.webp');
  });

  it('detecta códigos de norma del RNE', () => {
    expect('Ver A.130, E.030, IS.010 y GH.020 (no 1.234)'.match(CODIGO_NORMA)).toEqual(['A.130', 'E.030', 'IS.010', 'GH.020']);
  });
});
