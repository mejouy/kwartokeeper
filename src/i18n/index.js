// Language: English (the default) or Filipino, chosen per phone/browser.
//
//   t("Pay rent")                          → "Magbayad ng upa" in Filipino
//   t("Due in {n} days", { n: 3 })         → fills in {n}
//
// The English text itself is the key, so anything without a translation simply
// shows in English. Translations live in fil.js. Switching language reloads the
// page, so every screen (and every list built when the app starts) follows it.
import fil from "./fil";

const KEY = "kk_lang";
const LANGS = ["en", "fil"];

function readLang() {
  try {
    const saved = window.localStorage.getItem(KEY);
    return LANGS.includes(saved) ? saved : "en";
  } catch {
    return "en";
  }
}

export const lang = readLang();
if (typeof document !== "undefined") document.documentElement.lang = lang === "fil" ? "fil" : "en";

export function t(text, vars) {
  let out = lang === "fil" ? fil[text] ?? text : text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (match, key) => (vars[key] ?? match));
  return out;
}

export function setLanguage(next) {
  if (!LANGS.includes(next) || next === lang) return;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    return; // storage blocked: stay in the current language
  }
  window.location.reload();
}
