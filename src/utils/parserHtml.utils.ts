export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mathSpan(type: 'block-math' | 'inline-math', latex: string): string {
  return `<span data-type="${type}" data-latex="${escapeHtml(latex.trim())}"></span>`;
}

/**
 * Detects inline LaTeX patterns in text and wraps them in TipTap math nodes.
 * Supports $...$ for inline math and $$...$$ for block math.
 */
export function textWithMath(text: string): string {
  if (!text) return '';

  let result = escapeHtml(text);

  result = result.replace(/\$\$(.+?)\$\$/gs, (_match, latex: string) => mathSpan('block-math', latex));

  result = result.replace(/\$(.+?)\$/g, (_match, latex: string) => mathSpan('inline-math', latex));

  return result;
}

/**
 * Converts lightweight inline markup used in spreadsheet cells to TipTap HTML.
 * Supported markers: math ($...$, $$...$$), bold (**...**), italic (*...*),
 * strikethrough (~~...~~), and underline (++...++).
 */
export function inlineMarkupToHtml(text: string): string {
  if (!text) return '';

  const mathTokens: string[] = [];
  const tokenised = text
    .replace(/\$\$(.+?)\$\$/gs, (_match, latex: string) => {
      mathTokens.push(mathSpan('block-math', latex));
      return `\uE000${mathTokens.length - 1}\uE001`;
    })
    .replace(/\$([^$\n]+?)\$/g, (_match, latex: string) => {
      mathTokens.push(mathSpan('inline-math', latex));
      return `\uE000${mathTokens.length - 1}\uE001`;
    });

  let result = escapeHtml(tokenised);
  result = result.replace(/\*\*(.+?)\*\*/gs, (_match, value: string) => `<strong>${value}</strong>`);
  result = result.replace(/\*([^*\n]+?)\*/g, (_match, value: string) => `<em>${value}</em>`);
  result = result.replace(/~~(.+?)~~/gs, (_match, value: string) => `<s>${value}</s>`);
  result = result.replace(/\+\+(.+?)\+\+/gs, (_match, value: string) => `<u>${value}</u>`);
  result = result.replace(/\uE000(\d+)\uE001/g, (_match, index: string) => mathTokens[Number(index)] ?? '');

  return result;
}
