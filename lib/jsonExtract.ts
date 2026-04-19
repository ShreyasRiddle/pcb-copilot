/** Parse JSON from model output; tolerate markdown fences and extra text. */
export function extractJson<T>(text: string, fallback: T): T {
  const stripped = text.replace(/```(?:json)?[\s\S]*?```/g, (m) =>
    m.replace(/```(?:json)?/g, "").replace(/```$/, "")
  );
  try {
    return JSON.parse(stripped.trim()) as T;
  } catch {
    const arrMatch = stripped.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        return JSON.parse(arrMatch[0]) as T;
      } catch {
        /* fall through */
      }
    }
    const objMatch = stripped.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]) as T;
      } catch {
        /* fall through */
      }
    }
    return fallback;
  }
}
