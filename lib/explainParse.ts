/**
 * Parse Gemini explain-component output into structured sections.
 * Primary format uses <<<ROLE>>>, <<<MATH>>>, <<<RISK>>> markers.
 * Fallback: legacy "Section 1 — …" headings from older prompts.
 */

export type ParsedExplain = {
  role: string;
  math: string;
  risk: string;
};

export function parseExplanation(raw: string): ParsedExplain | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const m = trimmed.match(
    /<<<ROLE>>>\s*([\s\S]*?)\s*<<<MATH>>>\s*([\s\S]*?)\s*<<<RISK>>>\s*([\s\S]*)/i
  );
  if (m) {
    return {
      role: m[1].trim(),
      math: m[2].trim(),
      risk: m[3].trim(),
    };
  }

  // Fallback: "Section 1 — WHAT IT DOES" style (may appear without markers)
  const s1 = trimmed.match(
    /(?:^|\n)\s*Section\s*1[^.\n]*\n+([\s\S]*?)(?=\n\s*Section\s*2|\n\s*Section\s*[23]|$)/i
  );
  const s2 = trimmed.match(
    /(?:^|\n)\s*Section\s*2[^.\n]*\n+([\s\S]*?)(?=\n\s*Section\s*3|$)/i
  );
  const s3 = trimmed.match(
    /(?:^|\n)\s*Section\s*3[^.\n]*\n+([\s\S]*)$/i
  );

  if (s1 && s2 && s3) {
    return {
      role: s1[1].trim(),
      math: s2[1].trim(),
      risk: s3[1].trim(),
    };
  }

  return null;
}
