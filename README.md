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

## Usage Examples

Once configured, you can ask Copilot things like:

- *"What's the status of PROJ-123?"*
- *"Search for open bugs assigned to me in the BACKEND project"*
- *"Add a comment on PROJ-456 suggesting we refactor the auth module"*
- *"Create a new bug in PROJ for the login timeout issue"*
- *"Move PROJ-789 to In Review"*
- *"What's in the current sprint?"*

## Developing

### Prerequisites

- [Node.js](https://nodejs.org/) v22+
- npm

### Install dependencies

```sh
npm install
```

### Build

```sh
npm run build
```

To rebuild on file changes:

```sh
npm run dev
```

### Run tests

```sh
npm test
```

To run tests in watch mode during development:

```sh
npm run test:watch
```
