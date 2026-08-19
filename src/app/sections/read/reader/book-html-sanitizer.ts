import DOMPurify from 'dompurify';

const BOOK_HTML_TAGS = [
  'a',
  'b',
  'blockquote',
  'br',
  'cite',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'q',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'u',
  'ul',
] as const;

const BOOK_HTML_ATTRIBUTES = [
  'alt',
  'class',
  'dir',
  'height',
  'href',
  'id',
  'lang',
  'role',
  'src',
  'tabindex',
  'title',
  'width',
] as const;

/**
 * Browser-side defense in depth for imported book HTML.
 *
 * The backend must also sanitize content at ingestion. This allowlist keeps only
 * the structural markup used by the reader and its parallel-text formatter.
 */
export function sanitizeBookHtml(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [...BOOK_HTML_TAGS],
    ALLOWED_ATTR: [...BOOK_HTML_ATTRIBUTES],
    ADD_ATTR: ['data-pair'],
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
  });
}
