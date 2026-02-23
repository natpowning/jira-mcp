#!/usr/bin/env node

/**
 * Jira MCP Server
 *
 * Exposes Jira functionality as MCP tools so that Copilot (and other
 * MCP-compatible agents) can fetch tickets, add comments, search, transition
 * issues, and more.
 *
 * Environment variables (also read from .env if present):
 *   JIRA_BASE_URL  – e.g. https://yourcompany.atlassian.net
 *   JIRA_EMAIL     – your Jira email
 *   JIRA_API_TOKEN – API token from https://id.atlassian.com/manage-profile/security/api-tokens
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { JiraClient } from "./jira-client.js";
import { textToAdf, adfToText } from "./adf.js";

// ── Load configuration ────────────────────────────────────────────────

// Inline .env loader (avoids extra dependency)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file is optional
  }
}

loadDotEnv();

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error(
    "Missing required environment variables: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN"
  );
  process.exit(1);
}

const jira = new JiraClient({
  baseUrl: JIRA_BASE_URL,
  email: JIRA_EMAIL,
  apiToken: JIRA_API_TOKEN,
});

// ── Helper: format an issue for display ────────────────────────────────

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

// ── Create MCP Server ──────────────────────────────────────────────────

const server = new McpServer({
  name: "jira",
  version: "1.0.0",
});

// ── Tool: get_issue ────────────────────────────────────────────────────

server.tool(
  "get_issue",
  "Fetch full details for a Jira issue by its key (e.g. PROJ-123)",
  {
    issueKey: z.string().describe("The issue key, e.g. PROJ-123"),
  },
  async ({ issueKey }) => {
    const issue = await jira.getIssue(issueKey);
    return { content: [{ type: "text", text: formatIssue(issue) }] };
  }
);

// ── Tool: search_issues ────────────────────────────────────────────────

server.tool(
  "search_issues",
  "Search Jira issues using JQL (Jira Query Language). Returns up to maxResults issues.",
  {
    jql: z
      .string()
      .describe(
        'JQL query string, e.g. \'project = PROJ AND status = "In Progress"\''
      ),
    maxResults: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of results to return (default 10)"),
  },
  async ({ jql, maxResults }) => {
    const result = await jira.searchIssues(jql, undefined, maxResults);
    const issues = (result.issues ?? []) as any[];
    if (issues.length === 0) {
      return {
        content: [{ type: "text", text: "No issues found for that query." }],
      };
    }
    const total = result.total ?? issues.length;
    const text = issues.map(formatIssue).join("\n\n---\n\n");
    return {
      content: [
        {
          type: "text",
          text: `Found ${total} issue(s) (showing ${issues.length}):\n\n${text}`,
        },
      ],
    };
  }
);

// ── Tool: get_issue_comments ───────────────────────────────────────────

server.tool(
  "get_issue_comments",
  "Get all comments on a Jira issue",
  {
    issueKey: z.string().describe("The issue key, e.g. PROJ-123"),
    maxResults: z
      .number()
      .optional()
      .default(20)
      .describe("Maximum comments to fetch"),
  },
  async ({ issueKey, maxResults }) => {
    const result = await jira.getComments(issueKey, maxResults);
    const comments = (result.comments ?? []) as any[];
    if (comments.length === 0) {
      return {
        content: [
          { type: "text", text: `No comments on ${issueKey}.` },
        ],
      };
    }
    const text = comments.map(formatComment).join("\n\n---\n\n");
    return {
      content: [
        {
          type: "text",
          text: `${comments.length} comment(s) on ${issueKey}:\n\n${text}`,
        },
      ],
    };
  }
);

// ── Tool: add_comment ──────────────────────────────────────────────────

server.tool(
  "add_comment",
  "Add a comment to a Jira issue. Use this to post suggestions, notes, or status updates.",
  {
    issueKey: z.string().describe("The issue key, e.g. PROJ-123"),
    comment: z.string().describe("The comment text (plain text, will be converted to ADF)"),
  },
  async ({ issueKey, comment }) => {
    const body = textToAdf(comment);
    const result = await jira.addComment(issueKey, body);
    return {
      content: [
        {
          type: "text",
          text: `Comment added to ${issueKey} (id: ${result.id}).`,
        },
      ],
    };
  }
);

// ── Tool: create_issue ─────────────────────────────────────────────────

server.tool(
  "create_issue",
  "Create a new Jira issue in a project",
  {
    projectKey: z.string().describe("The project key, e.g. PROJ"),
    summary: z.string().describe("Issue summary / title"),
    issueType: z
      .string()
      .optional()
      .default("Task")
      .describe("Issue type name (Task, Bug, Story, Epic, etc.)"),
    description: z
      .string()
      .optional()
      .describe("Issue description in plain text"),
    assigneeAccountId: z
      .string()
      .optional()
      .describe("Assignee Jira account ID"),
    labels: z.array(z.string()).optional().describe("Labels to add"),
    priority: z
      .string()
      .optional()
      .describe("Priority name (Highest, High, Medium, Low, Lowest)"),
    parentKey: z
      .string()
      .optional()
      .describe("Parent issue key for sub-tasks"),
  },
  async ({ projectKey, summary, issueType, description, assigneeAccountId, labels, priority, parentKey }) => {
    const result = await jira.createIssue({
      projectKey,
      summary,
      issueType,
      description: description ? textToAdf(description) : undefined,
      assignee: assigneeAccountId,
      labels,
      priority,
      parentKey,
    });
    return {
      content: [
        {
          type: "text",
          text: `Issue created: **${result.key}** — ${JIRA_BASE_URL}/browse/${result.key}`,
        },
      ],
    };
  }
);

// ── Tool: update_issue ─────────────────────────────────────────────────

server.tool(
  "update_issue",
  "Update fields on an existing Jira issue (summary, description, priority, labels, assignee)",
  {
    issueKey: z.string().describe("The issue key, e.g. PROJ-123"),
    summary: z.string().optional().describe("New summary"),
    description: z.string().optional().describe("New description (plain text)"),
    priority: z.string().optional().describe("New priority name"),
    labels: z.array(z.string()).optional().describe("Replace labels"),
    assigneeAccountId: z
      .string()
      .optional()
      .describe("New assignee account ID (null to unassign)"),
  },
  async ({ issueKey, summary, description, priority, labels, assigneeAccountId }) => {
    const fields: Record<string, any> = {};
    if (summary) fields.summary = summary;
    if (description) fields.description = textToAdf(description);
    if (priority) fields.priority = { name: priority };
    if (labels) fields.labels = labels;
    if (assigneeAccountId !== undefined) {
      fields.assignee = { accountId: assigneeAccountId };
    }

    if (Object.keys(fields).length === 0) {
      return {
        content: [{ type: "text", text: "No fields to update." }],
      };
    }

    await jira.updateIssue(issueKey, fields);
    return {
      content: [
        {
          type: "text",
          text: `${issueKey} updated successfully (fields: ${Object.keys(fields).join(", ")}).`,
        },
      ],
    };
  }
);

// ── Tool: get_transitions ──────────────────────────────────────────────

server.tool(
  "get_transitions",
  "List available status transitions for a Jira issue (useful before calling transition_issue)",
  {
    issueKey: z.string().describe("The issue key, e.g. PROJ-123"),
  },
  async ({ issueKey }) => {
    const result = await jira.getTransitions(issueKey);
    const transitions = (result.transitions ?? []) as any[];
    if (transitions.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No transitions available for ${issueKey}.`,
          },
        ],
      };
    }
    const text = transitions
      .map(
        (t: any) =>
          `• **${t.name}** (id: ${t.id}) → moves to "${t.to?.name ?? "?"}"`
      )
      .join("\n");
    return {
      content: [
        {
          type: "text",
          text: `Available transitions for ${issueKey}:\n${text}`,
        },
      ],
    };
  }
);

// ── Tool: transition_issue ─────────────────────────────────────────────

server.tool(
  "transition_issue",
  "Transition a Jira issue to a new status. Use get_transitions first to find the transition ID.",
  {
    issueKey: z.string().describe("The issue key, e.g. PROJ-123"),
    transitionId: z
      .string()
      .describe("Transition ID (from get_transitions)"),
    comment: z
      .string()
      .optional()
      .describe("Optional comment to add with the transition"),
  },
  async ({ issueKey, transitionId, comment }) => {
    await jira.transitionIssue(
      issueKey,
      transitionId,
      comment ? textToAdf(comment) : undefined
    );
    return {
      content: [
        {
          type: "text",
          text: `${issueKey} transitioned successfully.`,
        },
      ],
    };
  }
);

// ── Tool: assign_issue ─────────────────────────────────────────────────

server.tool(
  "assign_issue",
  "Assign (or unassign) a Jira issue to a user",
  {
    issueKey: z.string().describe("The issue key, e.g. PROJ-123"),
    accountId: z
      .string()
      .nullable()
      .describe(
        "The Jira account ID of the assignee, or null to unassign"
      ),
  },
  async ({ issueKey, accountId }) => {
    await jira.assignIssue(issueKey, accountId);
    return {
      content: [
        {
          type: "text",
          text: accountId
            ? `${issueKey} assigned to account ${accountId}.`
            : `${issueKey} unassigned.`,
        },
      ],
    };
  }
);

// ── Tool: find_users ───────────────────────────────────────────────────

server.tool(
  "find_users",
  "Search for Jira users by name or email. Useful for finding accountId to assign issues.",
  {
    query: z.string().describe("Name or email to search for"),
  },
  async ({ query }) => {
    const users = (await jira.findUsers(query)) as any[];
    if (users.length === 0) {
      return {
        content: [{ type: "text", text: `No users found for "${query}".` }],
      };
    }
    const text = users
      .map(
        (u: any) =>
          `• ${u.displayName} — accountId: ${u.accountId} (${u.emailAddress ?? "no email"})`
      )
      .join("\n");
    return { content: [{ type: "text", text }] };
  }
);

// ── Tool: list_projects ────────────────────────────────────────────────

server.tool(
  "list_projects",
  "List Jira projects accessible to the authenticated user",
  {},
  async () => {
    const result = await jira.listProjects();
    const projects = (result.values ?? []) as any[];
    if (projects.length === 0) {
      return { content: [{ type: "text", text: "No projects found." }] };
    }
    const text = projects
      .map((p: any) => `• **${p.key}** — ${p.name}`)
      .join("\n");
    return {
      content: [
        {
          type: "text",
          text: `${projects.length} project(s):\n${text}`,
        },
      ],
    };
  }
);

// ── Tool: link_issues ──────────────────────────────────────────────────

server.tool(
  "link_issues",
  'Create a link between two Jira issues (e.g. "blocks", "is blocked by", "relates to")',
  {
    linkType: z
      .string()
      .describe('Link type name, e.g. "Blocks", "Relates", "Duplicate"'),
    inwardIssueKey: z.string().describe("The inward issue key"),
    outwardIssueKey: z.string().describe("The outward issue key"),
  },
  async ({ linkType, inwardIssueKey, outwardIssueKey }) => {
    await jira.linkIssues(linkType, inwardIssueKey, outwardIssueKey);
    return {
      content: [
        {
          type: "text",
          text: `Linked ${inwardIssueKey} → (${linkType}) → ${outwardIssueKey}.`,
        },
      ],
    };
  }
);

// ── Tool: add_worklog ──────────────────────────────────────────────────

server.tool(
  "add_worklog",
  "Log time spent on a Jira issue",
  {
    issueKey: z.string().describe("The issue key, e.g. PROJ-123"),
    timeSpent: z
      .string()
      .describe('Time spent in Jira format, e.g. "2h 30m", "1d"'),
    comment: z.string().optional().describe("Optional worklog comment"),
  },
  async ({ issueKey, timeSpent, comment }) => {
    await jira.addWorklog(
      issueKey,
      timeSpent,
      comment ? textToAdf(comment) : undefined
    );
    return {
      content: [
        {
          type: "text",
          text: `Logged ${timeSpent} on ${issueKey}.`,
        },
      ],
    };
  }
);

// ── Tool: list_sprints ─────────────────────────────────────────────────

server.tool(
  "list_sprints",
  "List sprints for a Jira board (requires board ID). Use list_boards first to find the board ID.",
  {
    boardId: z.number().describe("The Jira board ID"),
    state: z
      .string()
      .optional()
      .describe('Filter by state: "active", "future", "closed"'),
  },
  async ({ boardId, state }) => {
    const result = await jira.getSprintsForBoard(boardId, state);
    const sprints = (result.values ?? []) as any[];
    if (sprints.length === 0) {
      return { content: [{ type: "text", text: "No sprints found." }] };
    }
    const text = sprints
      .map(
        (s: any) =>
          `• **${s.name}** (id: ${s.id}) — state: ${s.state}, ${s.startDate ?? "?"} to ${s.endDate ?? "?"}`
      )
      .join("\n");
    return { content: [{ type: "text", text }] };
  }
);

// ── Tool: list_boards ──────────────────────────────────────────────────

server.tool(
  "list_boards",
  "List Jira boards (Scrum / Kanban). Use this to find board IDs for sprint queries.",
  {},
  async () => {
    const result = await jira.getBoards();
    const boards = (result.values ?? []) as any[];
    if (boards.length === 0) {
      return { content: [{ type: "text", text: "No boards found." }] };
    }
    const text = boards
      .map(
        (b: any) =>
          `• **${b.name}** (id: ${b.id}) — type: ${b.type}`
      )
      .join("\n");
    return { content: [{ type: "text", text }] };
  }
);

// ── Tool: get_sprint_issues ────────────────────────────────────────────

server.tool(
  "get_sprint_issues",
  "Get all issues in a specific sprint",
  {
    sprintId: z.number().describe("The sprint ID (from list_sprints)"),
  },
  async ({ sprintId }) => {
    const result = await jira.getSprintIssues(sprintId, [
      "summary",
      "status",
      "assignee",
      "priority",
      "issuetype",
    ]);
    const issues = (result.issues ?? []) as any[];
    if (issues.length === 0) {
      return { content: [{ type: "text", text: "No issues in this sprint." }] };
    }
    const text = issues.map(formatIssue).join("\n\n---\n\n");
    return {
      content: [
        {
          type: "text",
          text: `${issues.length} issue(s) in sprint ${sprintId}:\n\n${text}`,
        },
      ],
    };
  }
);

// ── Start server ───────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Jira MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
