import { describe, it, expect } from "vitest";
import { textToAdf, adfToText } from "./adf.js";

// ── textToAdf ──────────────────────────────────────────────────────────

describe("textToAdf", () => {
  it("wraps a single line in a doc with one paragraph", () => {
    const result = textToAdf("Hello world");
    expect(result).toEqual({
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    });
  });

  it("splits double newlines into separate paragraphs", () => {
    const result = textToAdf("First paragraph\n\nSecond paragraph");
    expect(result.content).toHaveLength(2);
    expect(result.content[0].content[0].text).toBe("First paragraph");
    expect(result.content[1].content[0].text).toBe("Second paragraph");
  });

  it("converts single newlines within a paragraph to hardBreaks", () => {
    const result = textToAdf("Line one\nLine two\nLine three");
    expect(result.content).toHaveLength(1);
    const nodes = result.content[0].content;
    expect(nodes).toEqual([
      { type: "text", text: "Line one" },
      { type: "hardBreak" },
      { type: "text", text: "Line two" },
      { type: "hardBreak" },
      { type: "text", text: "Line three" },
    ]);
  });

  it("handles empty string", () => {
    const result = textToAdf("");
    expect(result.type).toBe("doc");
    expect(result.version).toBe(1);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("paragraph");
  });

  it("handles mixed single and double newlines", () => {
    const result = textToAdf("A\nB\n\nC\nD");
    expect(result.content).toHaveLength(2);
    // First paragraph: A + hardBreak + B
    expect(result.content[0].content).toEqual([
      { type: "text", text: "A" },
      { type: "hardBreak" },
      { type: "text", text: "B" },
    ]);
    // Second paragraph: C + hardBreak + D
    expect(result.content[1].content).toEqual([
      { type: "text", text: "C" },
      { type: "hardBreak" },
      { type: "text", text: "D" },
    ]);
  });
});

// ── adfToText ──────────────────────────────────────────────────────────

describe("adfToText", () => {
  it("extracts text from a simple paragraph", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    };
    expect(adfToText(adf)).toBe("Hello");
  });

  it("joins multiple paragraphs with double newlines", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First" }] },
        { type: "paragraph", content: [{ type: "text", text: "Second" }] },
      ],
    };
    expect(adfToText(adf)).toBe("First\n\nSecond");
  });

  it("converts hardBreak to newline", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Line 1" },
            { type: "hardBreak" },
            { type: "text", text: "Line 2" },
          ],
        },
      ],
    };
    expect(adfToText(adf)).toBe("Line 1\nLine 2");
  });

  it("converts mention nodes", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "mention", attrs: { text: "Alice" } },
          ],
        },
      ],
    };
    expect(adfToText(adf)).toBe("Hello @Alice");
  });

  it("converts codeBlock nodes", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [{ type: "text", text: 'const x = 1;' }],
        },
      ],
    };
    expect(adfToText(adf)).toBe("```ts\nconst x = 1;\n```");
  });

  it("converts heading nodes", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Title" }],
        },
      ],
    };
    expect(adfToText(adf)).toBe("## Title");
  });

  it("converts bulletList with listItems", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Item A" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Item B" }] },
              ],
            },
          ],
        },
      ],
    };
    expect(adfToText(adf)).toBe("• Item A• Item B");
  });

  it("converts blockquote nodes", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Quoted text" }] },
          ],
        },
      ],
    };
    expect(adfToText(adf)).toBe("> Quoted text");
  });

  it("returns empty string for null / undefined / missing content", () => {
    expect(adfToText(null)).toBe("");
    expect(adfToText(undefined)).toBe("");
    expect(adfToText({})).toBe("");
  });

  it("round-trips simple text", () => {
    const original = "Hello world";
    expect(adfToText(textToAdf(original))).toBe(original);
  });

  it("round-trips multiline text with paragraphs", () => {
    const original = "First paragraph\n\nSecond paragraph";
    expect(adfToText(textToAdf(original))).toBe(original);
  });

  it("round-trips text with hard breaks", () => {
    const original = "Line one\nLine two";
    expect(adfToText(textToAdf(original))).toBe(original);
  });
});
