export function detectLanguage(text) {
  const hindi = (text.match(/\p{Script=Devanagari}/gu) ?? []).length;
  const english = (text.match(/[a-z]/gi) ?? []).length;
  if (!hindi && !english) return 'unknown';

  const hindiShare = hindi / (hindi + english);
  if (hindiShare > 0.85) return 'hi';
  if (hindiShare < 0.15) return 'en';
  return 'hi-en';
}

export function makeTitle(text, maxWords = 8) {
  const words = text.trim().split(/\s+/);
  const title = words.slice(0, maxWords).join(' ');
  return (words.length > maxWords ? title + '...' : title).slice(0, 200);
}
