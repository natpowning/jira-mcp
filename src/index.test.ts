import { describe, it, expect } from "vitest";
import { adfToText, textToAdf } from "./adf.js";

/**
 * Tests for the formatIssue / formatComment helpers defined in index.ts.
 *
 * Because index.ts runs side-effects on import (env checking, MCP server init),
 * we replicate the formatting logic here to test it in isolation. If the helpers
 * are ever extracted into their own module, these tests can import them directly.
 */

// ── Replicated formatIssue (matches index.ts logic) ────────────────────

function formatIssue(issue: any): string {
  const f = issue.fields ?? {};
  const lines: string[] = [
    `**${issue.key}** — ${f.summary ?? "(no summary)"}`,
    `Type: ${f.issuetype?.name ?? "?"}  |  Status: ${f.status?.name ?? "?"}  |  Priority: ${f.priority?.name ?? "?"}`,
  ];
  if (f.assignee) {
    lines.push(`Assignee: ${f.assignee.displayName} (${f.assignee.accountId})`);
  }
  if (f.reporter) {
    lines.push(`Reporter: ${f.reporter.displayName}`);
  }
  if (f.labels?.length) {
    lines.push(`Labels: ${f.labels.join(", ")}`);
  }
  if (f.created) {
    lines.push(`Created: ${f.created}  |  Updated: ${f.updated ?? "?"}`);
  }
  if (f.description) {
    lines.push(`\nDescription:\n${adfToText(f.description)}`);
  }
  return lines.join("\n");
}

function formatComment(c: any): string {
  const author = c.author?.displayName ?? "Unknown";
  const created = c.created ?? "";
  const body = c.body ? adfToText(c.body) : "(empty)";
  return `[${created}] ${author}:\n${body}`;
}

// ── formatIssue tests ──────────────────────────────────────────────────

describe("formatIssue", () => {
  it("formats a full issue with all fields", () => {
    const issue = {
      key: "PROJ-42",
      fields: {
        summary: "Fix the bug",
        issuetype: { name: "Bug" },
        status: { name: "In Progress" },
        priority: { name: "High" },
        assignee: { displayName: "Alice", accountId: "acc-1" },
        reporter: { displayName: "Bob" },
        labels: ["frontend", "urgent"],
        created: "2025-01-01T00:00:00Z",
        updated: "2025-01-02T00:00:00Z",
        description: textToAdf("Some description text"),
      },
    };

    const text = formatIssue(issue);
    expect(text).toContain("**PROJ-42** — Fix the bug");
    expect(text).toContain("Type: Bug");
    expect(text).toContain("Status: In Progress");
    expect(text).toContain("Priority: High");
    expect(text).toContain("Assignee: Alice (acc-1)");
    expect(text).toContain("Reporter: Bob");
    expect(text).toContain("Labels: frontend, urgent");
    expect(text).toContain("Created: 2025-01-01T00:00:00Z");
    expect(text).toContain("Updated: 2025-01-02T00:00:00Z");
    expect(text).toContain("Description:\nSome description text");
  });

  it("handles minimal issue with no optional fields", () => {
    const issue = { key: "X-1", fields: { summary: "Minimal" } };
    const text = formatIssue(issue);
    expect(text).toContain("**X-1** — Minimal");
    expect(text).toContain("Type: ?");
    expect(text).not.toContain("Assignee");
    expect(text).not.toContain("Reporter");
    expect(text).not.toContain("Labels");
    expect(text).not.toContain("Description");
  });

  it("handles missing fields object", () => {
    const issue = { key: "Y-1" };
    const text = formatIssue(issue);
    expect(text).toContain("**Y-1** — (no summary)");
  });

  it("shows ? for missing updated date", () => {
    const issue = {
      key: "Z-1",
      fields: { created: "2025-01-01", summary: "Test" },
    };
    const text = formatIssue(issue);
    expect(text).toContain("Updated: ?");
  });
});

// ── formatComment tests ────────────────────────────────────────────────

describe("formatComment", () => {
  it("formats a comment with author and body", () => {
    const comment = {
      author: { displayName: "Alice" },
      created: "2025-06-01T12:00:00Z",
      body: textToAdf("Looks good!"),
    };
    const text = formatComment(comment);
    expect(text).toBe("[2025-06-01T12:00:00Z] Alice:\nLooks good!");
  });

  it("uses Unknown for missing author", () => {
    const comment = { created: "2025-06-01", body: textToAdf("hi") };
    const text = formatComment(comment);
    expect(text).toContain("Unknown");
  });

  it("shows (empty) when body is missing", () => {
    const comment = { author: { displayName: "Bob" } };
    const text = formatComment(comment);
    expect(text).toContain("(empty)");
  });

  it("handles completely empty comment", () => {
    const text = formatComment({});
    expect(text).toBe("[] Unknown:\n(empty)");
  });
});
