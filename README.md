# Jira MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that lets Copilot and other AI agents interact with Jira. It exposes a rich set of tools for managing issues, comments, sprints, and more — all over stdio.

## Tools Provided

| Tool | Description |
|---|---|
| `get_issue` | Fetch full details for an issue by key |
| `search_issues` | Search with JQL |
| `get_issue_comments` | Read comments on an issue |
| `add_comment` | Post a comment (suggestions, notes, etc.) |
| `create_issue` | Create a new issue |
| `update_issue` | Update fields (summary, description, priority, labels, assignee) |
| `get_transitions` | List available status transitions |
| `transition_issue` | Move an issue to a new status |
| `assign_issue` | Assign or unassign an issue |
| `find_users` | Search users by name/email (for getting account IDs) |
| `list_projects` | List accessible projects |
| `link_issues` | Link two issues together |
| `add_worklog` | Log time on an issue |
| `list_boards` | List Scrum/Kanban boards |
| `list_sprints` | List sprints for a board |
| `get_sprint_issues` | Get issues in a sprint |

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Configure Jira credentials

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=your-api-token-here
```

Generate an API token at: https://id.atlassian.com/manage-profile/security/api-tokens

### 4. Register with VS Code / Copilot

Add this to your **VS Code settings** (`.vscode/settings.json` in your project, or your user settings):

```jsonc
{
  "mcp": {
    "servers": {
      "jira": {
        "command": "node",
        "args": ["/absolute/path/to/jira/dist/index.js"],
        "env": {
          "JIRA_BASE_URL": "https://yourcompany.atlassian.net",
          "JIRA_EMAIL": "you@example.com",
          "JIRA_API_TOKEN": "your-api-token-here"
        }
      }
    }
  }
}
```

Replace the path and credentials with your actual values. Once configured, Copilot will automatically discover and offer the Jira tools in chat.

### Alternative: Use `.env` file

If you prefer not to put credentials in settings, ensure the `.env` file is in the working directory when the server starts. The server reads it automatically.

## Usage Examples

Once configured, you can ask Copilot things like:

- *"What's the status of PROJ-123?"*
- *"Search for open bugs assigned to me in the BACKEND project"*
- *"Add a comment on PROJ-456 suggesting we refactor the auth module"*
- *"Create a new bug in PROJ for the login timeout issue"*
- *"Move PROJ-789 to In Review"*
- *"What's in the current sprint?"*

## Development

```bash
npm run dev    # watch mode — rebuilds on change
npm run build  # one-time build
npm start      # run the server
```
