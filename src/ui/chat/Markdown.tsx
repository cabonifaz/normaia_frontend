import { memo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CODIGO_NORMA } from '@/domain/chat/chat';

/**
 * Render seguro de respuestas del RAG.
 * El texto del modelo es NO confiable (puede venir de documentos con inyección de prompt):
 *  - HTML crudo: se muestra como texto (sin rehype-raw; skipHtml).
 *  - Imágenes markdown: bloqueadas (evitan exfiltración por URL y tracking).
 *  - Enlaces: solo https/mailto, en pestaña nueva, sin referrer y con el dominio visible.
 */

interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** Plugin rehype: envuelve los códigos de norma (A.130, E.030…) en <span class="norma-code">. */
function rehypeNormaCodes() {
  const skip = new Set(['code', 'pre', 'a']);
  const visit = (node: HastNode) => {
    if (!node.children) return;
    if (node.type === 'element' && node.tagName && skip.has(node.tagName)) return;
    const out: HastNode[] = [];
    for (const child of node.children) {
      if (child.type !== 'text' || !child.value) {
        visit(child);
        out.push(child);
        continue;
      }
      const text = child.value;
      let last = 0;
      for (const m of text.matchAll(CODIGO_NORMA)) {
        const i = m.index ?? 0;
        if (i > last) out.push({ type: 'text', value: text.slice(last, i) });
        out.push({ type: 'element', tagName: 'span', properties: { className: ['norma-code'] }, children: [{ type: 'text', value: m[0] }] });
        last = i + m[0].length;
      }
      if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
    }
    node.children = out;
  };
  return (tree: HastNode) => visit(tree);
}

const SAFE_URL = /^(https:\/\/|mailto:)/i;

function hostOf(href: string): string | null {
  try {
    return new URL(href).hostname;
  } catch {
    return null;
  }
}

const components: Components = {
  a({ href, children }) {
    if (!href || !SAFE_URL.test(href)) return <span>{children}</span>;
    const host = hostOf(href);
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" title={host ? `Abre ${host} en una pestaña nueva` : undefined}>
        {children}
      </a>
    );
  },
  img({ alt }) {
    return alt ? <span>[{alt}]</span> : null;
  },
  table({ children }) {
    return (
      <div className="md-table" role="region" aria-label="Tabla" tabIndex={0}>
        <table>{children}</table>
      </div>
    );
  },
};

export const Markdown = memo(function Markdown({ text, trailing }: { text: string; trailing?: ReactNode }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeNormaCodes]} components={components} skipHtml>
        {text}
      </ReactMarkdown>
      {trailing}
    </div>
  );
});
