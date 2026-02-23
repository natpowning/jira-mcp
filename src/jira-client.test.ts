import { describe, it, expect, vi, beforeEach } from "vitest";
import { JiraClient } from "./jira-client.js";

// ── Helpers ────────────────────────────────────────────────────────────

function makeClient() {
  return new JiraClient({
    baseUrl: "https://test.atlassian.net",
    email: "user@example.com",
    apiToken: "test-token",
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function noContentResponse() {
  return new Response(null, { status: 204 });
}

function errorResponse(status: number, body: string) {
  return new Response(body, { status, headers: {} });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("JiraClient", () => {
  let client: JiraClient;

  beforeEach(() => {
    client = makeClient();
    vi.restoreAllMocks();
  });

  // ── Constructor ────────────────────────────────────────────────────

  describe("constructor", () => {
    it("strips trailing slashes from the base URL", () => {
      const c = new JiraClient({
        baseUrl: "https://example.atlassian.net///",
        email: "a@b.com",
        apiToken: "tok",
      });
      // We verify indirectly: fetch should be called with the cleaned URL
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ key: "X-1" }));
      c.getIssue("X-1");
      expect(spy).toHaveBeenCalledWith(
        "https://example.atlassian.net/rest/api/3/issue/X-1",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("sets correct auth headers", async () => {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}));
      await client.getIssue("T-1");
      const expected = Buffer.from("user@example.com:test-token").toString("base64");
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${expected}`,
          }),
        })
      );
    });
  });

  // ── getIssue ───────────────────────────────────────────────────────

  describe("getIssue", () => {
    it("fetches an issue by key", async () => {
      const issue = { key: "PROJ-1", fields: { summary: "Test" } };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(issue));

      const result = await client.getIssue("PROJ-1");
      expect(result).toEqual(issue);
      expect(fetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/api/3/issue/PROJ-1",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("appends fields query param when provided", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}));
      await client.getIssue("X-1", ["summary", "status"]);
      expect(fetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/api/3/issue/X-1?fields=summary,status",
        expect.anything()
      );
    });

    it("throws on non-OK response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(errorResponse(404, "Not found"));
      await expect(client.getIssue("BAD-1")).rejects.toThrow("returned 404");
    });
  });

  // ── createIssue ────────────────────────────────────────────────────

  describe("createIssue", () => {
    it("sends correct payload with required fields", async () => {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ key: "PROJ-2" })
      );

      const result = await client.createIssue({
        projectKey: "PROJ",
        summary: "New task",
        issueType: "Task",
      });

      expect(result).toEqual({ key: "PROJ-2" });
      const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
      expect(body.fields).toEqual({
        project: { key: "PROJ" },
        summary: "New task",
        issuetype: { name: "Task" },
      });
    });

    it("includes optional fields when provided", async () => {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ key: "PROJ-3" })
      );

      await client.createIssue({
        projectKey: "PROJ",
        summary: "Bug report",
        issueType: "Bug",
        description: { type: "doc" },
        assignee: "abc123",
        labels: ["urgent"],
        priority: "High",
        parentKey: "PROJ-1",
      });

      const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
      expect(body.fields.description).toEqual({ type: "doc" });
      expect(body.fields.assignee).toEqual({ accountId: "abc123" });
      expect(body.fields.labels).toEqual(["urgent"]);
      expect(body.fields.priority).toEqual({ name: "High" });
      expect(body.fields.parent).toEqual({ key: "PROJ-1" });
    });
  });

  // ── updateIssue ────────────────────────────────────────────────────

  describe("updateIssue", () => {
    it("sends PUT request with fields", async () => {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(noContentResponse());
      await client.updateIssue("PROJ-1", { summary: "Updated" });

      expect(spy).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/api/3/issue/PROJ-1",
        expect.objectContaining({ method: "PUT" })
      );
      const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
      expect(body.fields.summary).toBe("Updated");
    });
  });

  // ── searchIssues ───────────────────────────────────────────────────

  describe("searchIssues", () => {
    it("constructs correct query parameters", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ issues: [], total: 0 })
      );

      await client.searchIssues("project = PROJ", ["summary"], 5);
      const url = (fetch as any).mock.calls[0][0] as string;
      expect(url).toContain("jql=project+%3D+PROJ");
      expect(url).toContain("fields=summary");
      expect(url).toContain("maxResults=5");
    });

    it("uses default fields when none provided", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ issues: [], total: 0 })
      );
      await client.searchIssues("status = Open");
      const url = (fetch as any).mock.calls[0][0] as string;
      expect(url).toContain("fields=summary%2Cstatus%2Cassignee%2Cpriority%2Cissuetype%2Ccreated%2Cupdated");
    });

    it("includes nextPageToken when provided", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ issues: [] })
      );
      await client.searchIssues("project = X", undefined, 20, "abc123");
      const url = (fetch as any).mock.calls[0][0] as string;
      expect(url).toContain("nextPageToken=abc123");
    });
  });

  // ── Comments ───────────────────────────────────────────────────────

  describe("getComments", () => {
    it("fetches comments with pagination params", async () => {
      const data = { comments: [{ id: "1", body: {} }] };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(data));

      const result = await client.getComments("PROJ-1", 10, 5);
      expect(result).toEqual(data);
      expect(fetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/api/3/issue/PROJ-1/comment?maxResults=10&startAt=5",
        expect.anything()
      );
    });
  });

  describe("addComment", () => {
    it("posts a comment body", async () => {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ id: "100" })
      );
      const body = { type: "doc", version: 1, content: [] };
      const result = await client.addComment("PROJ-1", body);
      expect(result.id).toBe("100");
      const sent = JSON.parse(spy.mock.calls[0][1]!.body as string);
      expect(sent.body).toEqual(body);
    });
  });

  // ── Transitions ────────────────────────────────────────────────────

  describe("getTransitions", () => {
    it("returns transitions for an issue", async () => {
      const data = { transitions: [{ id: "31", name: "Done" }] };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(data));
      const result = await client.getTransitions("PROJ-1");
      expect(result.transitions).toHaveLength(1);
    });
  });

  describe("transitionIssue", () => {
    it("sends transition without comment", async () => {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(noContentResponse());
      await client.transitionIssue("PROJ-1", "31");
      const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
      expect(body.transition).toEqual({ id: "31" });
      expect(body.update).toBeUndefined();
    });

    it("sends transition with comment", async () => {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(noContentResponse());
      const comment = { type: "doc" };
      await client.transitionIssue("PROJ-1", "31", comment);
      const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
      expect(body.update.comment[0].add.body).toEqual(comment);
    });
  });

  // ── assignIssue ────────────────────────────────────────────────────

  describe("assignIssue", () => {
    it("sends PUT with accountId", async () => {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(noContentResponse());
      await client.assignIssue("PROJ-1", "user-123");
      const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
      expect(body.accountId).toBe("user-123");
    });

    it("sends null accountId to unassign", async () => {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(noContentResponse());
      await client.assignIssue("PROJ-1", null);
      const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
      expect(body.accountId).toBeNull();
    });
  });

  // ── findUsers ──────────────────────────────────────────────────────

  describe("findUsers", () => {
    it("searches with encoded query", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
      await client.findUsers("John Doe", 5);
      expect(fetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/api/3/user/search?query=John%20Doe&maxResults=5",
        expect.anything()
      );
    });
  });

  // ── listProjects ───────────────────────────────────────────────────

  describe("listProjects", () => {
    it("fetches projects with pagination", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse({ values: [{ key: "PROJ" }] })
      );
      const result = await client.listProjects(10, 5);
      expect(fetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/api/3/project/search?maxResults=10&startAt=5",
        expect.anything()
      );
      expect(result.values).toHaveLength(1);
    });
  });

  // ── Worklogs ───────────────────────────────────────────────────────

  describe("getWorklogs", () => {
    it("fetches worklogs for an issue", async () => {
      const data = { worklogs: [] };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(data));
      const result = await client.getWorklogs("PROJ-1");
      expect(result).toEqual(data);
    });
  });

  describe("addWorklog", () => {
    it("sends worklog with timeSpent", async () => {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ id: "1" }));
      await client.addWorklog("PROJ-1", "2h");
      const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
      expect(body.timeSpent).toBe("2h");
      expect(body.comment).toBeUndefined();
    });

    it("includes comment when provided", async () => {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ id: "2" }));
      const comment = { type: "doc" };
      await client.addWorklog("PROJ-1", "1d", comment);
      const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
      expect(body.timeSpent).toBe("1d");
      expect(body.comment).toEqual(comment);
    });
  });

  // ── linkIssues ─────────────────────────────────────────────────────

  describe("linkIssues", () => {
    it("sends correct link payload", async () => {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(noContentResponse());
      await client.linkIssues("Blocks", "PROJ-1", "PROJ-2");
      const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
      expect(body).toEqual({
        type: { name: "Blocks" },
        inwardIssue: { key: "PROJ-1" },
        outwardIssue: { key: "PROJ-2" },
      });
    });
  });

  // ── Agile endpoints ────────────────────────────────────────────────

  describe("getBoards", () => {
    it("fetches boards from agile API", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ values: [] }));
      await client.getBoards(10);
      expect(fetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/agile/1.0/board?maxResults=10",
        expect.objectContaining({ headers: expect.any(Object) })
      );
    });

    it("throws on non-OK agile response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("error", { status: 500 })
      );
      await expect(client.getBoards()).rejects.toThrow("returned 500");
    });
  });

  describe("getSprintsForBoard", () => {
    it("fetches sprints with optional state filter", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ values: [] }));
      await client.getSprintsForBoard(42, "active");
      expect(fetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/agile/1.0/board/42/sprint?maxResults=50&state=active",
        expect.anything()
      );
    });

    it("fetches sprints without state filter", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ values: [] }));
      await client.getSprintsForBoard(42);
      expect(fetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/agile/1.0/board/42/sprint?maxResults=50",
        expect.anything()
      );
    });
  });

  describe("getSprintIssues", () => {
    it("fetches sprint issues with optional fields", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ issues: [] }));
      await client.getSprintIssues(99, ["summary", "status"]);
      expect(fetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/agile/1.0/sprint/99/issue?maxResults=100&fields=summary,status",
        expect.anything()
      );
    });

    it("fetches sprint issues without fields", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ issues: [] }));
      await client.getSprintIssues(99);
      expect(fetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/agile/1.0/sprint/99/issue?maxResults=100",
        expect.anything()
      );
    });
  });
});
