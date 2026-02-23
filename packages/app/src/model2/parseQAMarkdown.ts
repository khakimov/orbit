/**
 * Parses simple Q./A. markdown format into card specs.
 *
 * Format:
 *   Q. What is X?
 *   A. Y
 *
 * Multiple cards separated by blank lines between Q/A pairs.
 */
export interface CardSpec {
  question: string;
  answer: string;
}

export function parseQAMarkdown(markdown: string): CardSpec[] {
  const cards: CardSpec[] = [];
  const lines = markdown.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Look for Q. prefix
    const qMatch = line.match(/^Q\.\s+(.*)/);
    if (!qMatch) {
      i++;
      continue;
    }

    // Collect question lines (everything until A. or blank)
    const questionParts = [qMatch[1]];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (next.match(/^A\.\s+/) || next === "") break;
      questionParts.push(next);
      i++;
    }

    // Skip blank lines between Q and A
    while (i < lines.length && lines[i].trim() === "") i++;

    // Look for A. prefix
    const aLine = lines[i]?.trim();
    const aMatch = aLine?.match(/^A\.\s+(.*)/);
    if (!aMatch) continue;

    // Collect answer lines (everything until next Q. or blank line followed by Q.)
    const answerParts = [aMatch[1]];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (next === "" || next.match(/^Q\.\s+/)) break;
      answerParts.push(next);
      i++;
    }

    cards.push({
      question: questionParts.join("\n"),
      answer: answerParts.join("\n"),
    });
  }

  return cards;
}
