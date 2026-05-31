/**
 * Parse a Gemini response that should contain 3 numbered recommendations.
 * Handles all common Gemini formatting variations robustly.
 */
export function parseRecommendations(raw: string, max = 3): string[] {
  // Strip markdown formatting
  const clean = raw
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^#+\s*/gm, "")
    .trim();

  // Strategy 1: split on numbered lines "1." / "1)" / "1:" at start of line or after newline
  const numbered = clean.split(/\n+(?=\s*[1-9][\.\):])/);
  const isPreamble = (s: string) => /^here are|^below are|^the following/i.test(s);
  const cleaned1 = numbered
    .map(p => p.replace(/^\s*[1-9][\.\):]\s*/, "").trim())
    .filter(p => p.length > 25 && !isPreamble(p));
  if (cleaned1.length >= 2) return cleaned1.slice(0, max);

  // Strategy 2: split on "1." / "2." / "3." anywhere mid-text
  const inline = clean.split(/(?<!\d)[1-9][\.\)]\s+/);
  const cleaned2 = inline
    .map(p => p.trim())
    .filter(p => p.length > 25 && !isPreamble(p));
  if (cleaned2.length >= 2) return cleaned2.slice(0, max);

  // Strategy 3: split on double newlines (paragraph breaks)
  const paras = clean
    .split(/\n{2,}/)
    .map(p => p.replace(/^\s*[1-9][\.\):]\s*/, "").replace(/\n/g, " ").trim())
    .filter(p => p.length > 25 && !/^here are/i.test(p));
  if (paras.length >= 2) return paras.slice(0, max);

  // Strategy 4: split on single newlines as last resort
  const lines = clean
    .split(/\n/)
    .map(l => l.replace(/^\s*[1-9][\.\):]\s*/, "").trim())
    .filter(l => l.length > 25 && !/^here are/i.test(l));
  return lines.slice(0, max);
}
