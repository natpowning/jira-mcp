/**
 * Lightweight Jira REST API client using native fetch.
 * Supports Jira Cloud (Atlassian) with basic-auth API tokens.
 */

export interface JiraConfig {
  baseUrl: string; // e.g. https://yourcompany.atlassian.net
  email: string;
  apiToken: string;
}

export class JiraClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: JiraConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    const credentials = Buffer.from(
      `${config.email}:${config.apiToken}`
    ).toString("base64");
    this.headers = {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  // ── Core request helper ──────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/rest/api/3${path}`;
    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Jira API ${method} ${path} returned ${res.status}: ${text}`
      );
    }

    // Some endpoints (204 No Content) return no body
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await res.json()) as T;
    }
    return undefined as unknown as T;
  }

  // ── Issues ───────────────────────────────────────────────────────────

  async getIssue(issueIdOrKey: string, fields?: string[]): Promise<any> {
    const params = fields ? `?fields=${fields.join(",")}` : "";
    return this.request("GET", `/issue/${issueIdOrKey}${params}`);
  }

  async createIssue(payload: {
    projectKey: string;
    summary: string;
    issueType: string;
    description?: any;
    assignee?: string;
    labels?: string[];
    priority?: string;
    parentKey?: string;
    [key: string]: unknown;
  }): Promise<any> {
    const fields: Record<string, any> = {
      project: { key: payload.projectKey },
      summary: payload.summary,
      issuetype: { name: payload.issueType },
    };
    if (payload.description) {
      fields.description = payload.description;
    }
    if (payload.assignee) {
      fields.assignee = { accountId: payload.assignee };
    }
    if (payload.labels) {
      fields.labels = payload.labels;
    }
    if (payload.priority) {
      fields.priority = { name: payload.priority };
    }
    if (payload.parentKey) {
      fields.parent = { key: payload.parentKey };
    }
    return this.request("POST", `/issue`, { fields });
  }

  async updateIssue(
    issueIdOrKey: string,
    fields: Record<string, any>
  ): Promise<void> {
    await this.request("PUT", `/issue/${issueIdOrKey}`, { fields });
  }

  // ── Search (JQL) ────────────────────────────────────────────────────

  async searchIssues(
    jql: string,
    fields?: string[],
    maxResults = 20,
    nextPageToken?: string
  ): Promise<any> {
    const f = (
      fields ?? [
        "summary",
        "status",
        "assignee",
        "priority",
        "issuetype",
        "created",
        "updated",
      ]
    ).join(",");
    const params = new URLSearchParams({
      jql,
      fields: f,
      maxResults: String(maxResults),
    });
    if (nextPageToken) {
      params.set("nextPageToken", nextPageToken);
    }
    return this.request("GET", `/search/jql?${params.toString()}`);
  }

  // ── Comments ─────────────────────────────────────────────────────────

  async getComments(
    issueIdOrKey: string,
    maxResults = 50,
    startAt = 0
  ): Promise<any> {
    return this.request(
      "GET",
      `/issue/${issueIdOrKey}/comment?maxResults=${maxResults}&startAt=${startAt}`
    );
  }

  async addComment(issueIdOrKey: string, body: any): Promise<any> {
    return this.request("POST", `/issue/${issueIdOrKey}/comment`, { body });
  }

  // ── Transitions ──────────────────────────────────────────────────────

  async getTransitions(issueIdOrKey: string): Promise<any> {
    return this.request("GET", `/issue/${issueIdOrKey}/transitions`);
  }

  async transitionIssue(
    issueIdOrKey: string,
    transitionId: string,
    comment?: any
  ): Promise<void> {
    const payload: Record<string, any> = {
      transition: { id: transitionId },
    };
    if (comment) {
      payload.update = {
        comment: [{ add: { body: comment } }],
      };
    }
    await this.request("POST", `/issue/${issueIdOrKey}/transitions`, payload);
  }

  // ── Assign ───────────────────────────────────────────────────────────

  async assignIssue(
    issueIdOrKey: string,
    accountId: string | null
  ): Promise<void> {
    await this.request("PUT", `/issue/${issueIdOrKey}/assignee`, {
      accountId,
    });
  }

  // ── Users ────────────────────────────────────────────────────────────

  async findUsers(query: string, maxResults = 10): Promise<any> {
    return this.request(
      "GET",
      `/user/search?query=${encodeURIComponent(query)}&maxResults=${maxResults}`
    );
  }

  // ── Projects ─────────────────────────────────────────────────────────

  async listProjects(maxResults = 50, startAt = 0): Promise<any> {
    return this.request(
      "GET",
      `/project/search?maxResults=${maxResults}&startAt=${startAt}`
    );
  }

  // ── Worklogs ─────────────────────────────────────────────────────────

  async getWorklogs(issueIdOrKey: string): Promise<any> {
    return this.request("GET", `/issue/${issueIdOrKey}/worklog`);
  }

  async addWorklog(
    issueIdOrKey: string,
    timeSpent: string,
    comment?: any
  ): Promise<any> {
    const payload: Record<string, any> = { timeSpent };
    if (comment) {
      payload.comment = comment;
    }
    return this.request(
      "POST",
      `/issue/${issueIdOrKey}/worklog`,
      payload
    );
  }

  // ── Link issues ──────────────────────────────────────────────────────

  async linkIssues(
    type: string,
    inwardIssueKey: string,
    outwardIssueKey: string
  ): Promise<void> {
    await this.request("POST", `/issueLink`, {
      type: { name: type },
      inwardIssue: { key: inwardIssueKey },
      outwardIssue: { key: outwardIssueKey },
    });
  }

  // ── Sprints & Boards (Agile REST API) ────────────────────────────────

  async getBoards(maxResults = 50): Promise<any> {
    const url = `${this.baseUrl}/rest/agile/1.0/board?maxResults=${maxResults}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`Jira Agile API returned ${res.status}`);
    return res.json();
  }

  async getSprintsForBoard(
    boardId: number,
    state?: string
  ): Promise<any> {
    const stateParam = state ? `&state=${state}` : "";
    const url = `${this.baseUrl}/rest/agile/1.0/board/${boardId}/sprint?maxResults=50${stateParam}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`Jira Agile API returned ${res.status}`);
    return res.json();
  }

  async getSprintIssues(
    sprintId: number,
    fields?: string[]
  ): Promise<any> {
    const fieldsParam = fields ? `&fields=${fields.join(",")}` : "";
    const url = `${this.baseUrl}/rest/agile/1.0/sprint/${sprintId}/issue?maxResults=100${fieldsParam}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`Jira Agile API returned ${res.status}`);
    return res.json();
  }
}
