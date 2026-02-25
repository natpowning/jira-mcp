# Jira MCP Server

A very simple [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that lets Copilot and other AI agents interact with Jira.  A primary goal of this project is to intentionally remain small such that users can quickly audit the code to confirm it only does what it should, and nothing more.


## VS Code Quick Start

1. In VS Code, open the Command Palette and run **MCP: Add Server...**
2. Select **Add Server...**
3. Select **NPM Package**
4. When prompted for the ***Package Name***, enter:

	```
	@natpowning/jira-mcp
	```
5. Select Allow to install the package
6. Enter the configuration values as prompted in the following order.

	- Jira instance URL (eg. `https://COMPANY.atlassian.net`)
	- Jira account email address (eg. `you@yourcompany.com`)
	- Jira API token: Generate [here](https://id.atlassian.com/manage-profile/security/api-tokens)
    - Server ID (eg. jira-mcp-yourcompany)

After saving, Copilot can call the Jira tools listed above through this MCP server.

## Usage Examples

Once configured, you can ask Copilot things like:

- *"What's the status of PROJ-123?"*
- *"Search for open bugs assigned to me in the BACKEND project"*
- *"Add a comment on PROJ-456 suggesting we refactor the auth module"*
- *"Create a new bug in PROJ for the login timeout issue"*
- *"Move PROJ-789 to In Review"*
- *"What's in the current sprint?"*
- *"Using multiple agents, decomp the Jira epic WEBUI-123 into subtasks and open pull requests for each subtask while keeping status and progress updated in the tasks moving from TODO, through In Progress, and Ready for Review."


### Copilot Instructions

If your repository uses a `copilot-instructions.md`, add a short section describing what this MCP server can do so agents know which tools exist and when to use them.

Example snippet to copy into `copilot-instructions.md`:

```md
## Jira MCP

This repo has access to the `jira` MCP server (Jira Cloud). Prefer using Jira tools over guessing ticket details.

Available tools:
- `search_issues` (JQL search)
- `get_issue` (issue details)
- `get_issue_comments` / `add_comment`
- `create_issue` / `update_issue`
- `get_transitions` / `transition_issue`
- `assign_issue`, `find_users`, `list_projects`
- `link_issues`, `add_worklog`
- `list_boards`, `list_sprints`, `get_sprint_issues`

When asked about Jira work:
- Use `search_issues` to find the right issue(s).
- Use `get_issue` to confirm status/assignee before acting.
- Use `add_comment` for status updates and coordination notes.
```

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


## Developing

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for commit messages. Common types include:

- `feat`: a new feature
- `fix`: a bug fix
- `docs`: documentation-only changes
- `test`: adding/updating tests
- `refactor`: code change that neither fixes a bug nor adds a feature
- `chore`: maintenance tasks (tooling, deps, etc.)

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
