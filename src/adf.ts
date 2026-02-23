/**
 * Helpers to convert between plain-text and Atlassian Document Format (ADF).
 * ADF is required for Jira Cloud REST API v3 for description / comment bodies.
 */

/** Wrap a plain-text string into a minimal ADF document. */
export function textToAdf(text: string): any {
  return {
    type: "doc",
    version: 1,
    content: text.split("\n\n").map((paragraph) => ({
      type: "paragraph",
      content: paragraph.split("\n").flatMap((line, i, arr) => {
        const nodes: any[] = [{ type: "text", text: line }];
        if (i < arr.length - 1) {
          nodes.push({ type: "hardBreak" });
        }
        return nodes;
      }),
    })),
  };
}

/** Extract readable plain-text from an ADF document (best-effort). */
export function adfToText(adf: any): string {
  if (!adf || !adf.content) return "";
  return adf.content
    .map((block: any) => extractBlockText(block))
    .join("\n\n");
}

function extractBlockText(node: any): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "mention") return `@${node.attrs?.text ?? "user"}`;

  if (node.type === "codeBlock") {
    const lang = node.attrs?.language ?? "";
    const code = (node.content ?? []).map(extractBlockText).join("");
    return `\`\`\`${lang}\n${code}\n\`\`\``;
  }

  if (node.content) {
    const inner = node.content.map(extractBlockText).join("");
    switch (node.type) {
      case "heading":
        return `${"#".repeat(node.attrs?.level ?? 1)} ${inner}`;
      case "bulletList":
      case "orderedList":
        return inner;
      case "listItem":
        return `• ${inner}`;
      case "blockquote":
        return inner
          .split("\n")
          .map((l: string) => `> ${l}`)
          .join("\n");
      default:
        return inner;
    }
  }

  return "";
}
