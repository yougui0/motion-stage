import {english} from './messages-en.mjs';

export const DEFAULT_LANGUAGE = 'zh-CN';
export const LANGUAGE_KEY = 'motion-stage:language';
const supported = new Set([DEFAULT_LANGUAGE, 'en']);

function browserLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const requested = new URL(window.location.href).searchParams.get('lang');
  if (supported.has(requested)) {
    rememberLanguage(requested);
    return requested;
  }
  try {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    if (supported.has(saved)) return saved;
  } catch {}
  return DEFAULT_LANGUAGE;
}

export const language = browserLanguage();

export function rememberLanguage(value) {
  if (!supported.has(value)) return false;
  try { window.localStorage.setItem(LANGUAGE_KEY, value); } catch {}
  return true;
}

export function localizedUrl(value, locale = language) {
  const url = new URL(value, window.location.href);
  url.searchParams.set('lang', locale);
  return url;
}

// Use only for workbench copy. User text, filenames, and protocol values
// are passed through directly or interpolated as arguments.
export function t(message, ...values) {
  const translated = language === 'en' && Object.hasOwn(english, message) ? english[message] : message;
  return values.length
    ? translated.replace(/\{(\d+)\}/g, (token, index) => Number(index) < values.length ? String(values[index]) : token)
    : translated;
}

export function translatePage(doc) {
  doc.documentElement.lang = language;
  if (language === DEFAULT_LANGUAGE) return;
  doc.title = t(doc.title);
  const walker = doc.createTreeWalker(doc.body, doc.defaultView.NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest('script,style')) continue;
    const copy = node.data.trim();
    if (Object.hasOwn(english, copy)) node.data = node.data.replace(copy, () => t(copy));
  }
  for (const item of doc.body.querySelectorAll('[title],[aria-label],[alt],[placeholder]')) {
    for (const attribute of ['title', 'aria-label', 'alt', 'placeholder']) {
      const copy = item.getAttribute(attribute);
      if (Object.hasOwn(english, copy)) item.setAttribute(attribute, t(copy));
    }
  }
}
