/** Literal substring pattern with explicit Unicode case pairs, including Turkish I. */
export function searchPattern(value: string): string {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  return Array.from(value.normalize("NFC"), (letter) => {
    if (/[iİIı]/u.test(letter)) return "[iİIı]";
    const lower = letter.toLocaleLowerCase("tr-TR");
    const upper = letter.toLocaleUpperCase("tr-TR");
    // Multi-character case expansions (e.g. ß → SS) are not character classes.
    if (lower !== upper && Array.from(lower).length === 1 && Array.from(upper).length === 1) {
      return `[${escape(lower)}${escape(upper)}]`;
    }
    return escape(letter);
  }).join("");
}

/** Quoting keeps user punctuation from becoming PostgREST filter syntax. */
export function searchOrFilter(columns: readonly string[], value: string): string {
  const pattern = JSON.stringify(searchPattern(value));
  return columns.map((column) => `${column}.match.${pattern}`).join(",");
}
