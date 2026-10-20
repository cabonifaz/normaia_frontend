/**
 * Contenido de la landing (supuestos del prototipo).
 * PENDIENTE: validar preguntas con consultas reales y confirmar que la base RAG ya incluye estas modificaciones.
 */
export const COVERAGE = [
  { title: 'Generalidades', codes: 'Título I, normas G', examples: [{ q: '¿Qué responsabilidades tiene el profesional responsable de obra?', norma: 'G.030' }] },
  { title: 'Habilitaciones urbanas', codes: 'Título II, normas GH, TH, OS y otras', examples: [{ q: '¿Qué aportes exige una habilitación residencial?', norma: 'TH.010' }] },
  { title: 'Arquitectura', codes: 'Título III, normas A', examples: [{ q: '¿Cuántas salidas de evacuación necesita un centro comercial?', norma: 'A.130' }] },
  { title: 'Estructuras', codes: 'Título III, normas E', examples: [{ q: '¿Qué cambió en la norma de diseño sismorresistente de 2026?', norma: 'E.030' }] },
  { title: 'Instalaciones', codes: 'Título III, normas IS y EM', examples: [{ q: '¿Cómo se calcula la dotación de agua de un edificio?', norma: 'IS.010' }] },
] as const;

export const UPDATES = [
  { datetime: '2026-05', label: 'Mayo 2026', title: 'E.030 Diseño Sismorresistente', detail: 'Modificada por la RM 183-2026-VIVIENDA' },
  { datetime: '2026-07', label: 'Julio 2026', title: 'G.010 Consideraciones Básicas y G.020 Principios Generales', detail: 'Modificadas por la RM 278-2026-VIVIENDA' },
] as const;
