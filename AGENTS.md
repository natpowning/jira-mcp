# Copilot Agents

## Code Review Agent

When reviewing pull requests for this repository:

- Verify all new code follows ESM conventions with `.js` file extensions in imports
- Check that new Jira API methods in `jira-client.ts` follow the existing pattern: thin wrappers around `this.request()` for REST API v3 endpoints, or direct `fetch` for Agile API endpoints
- Ensure new MCP tools in `index.ts` include a descriptive name, description string, Zod schema for parameters, and proper error handling
- Confirm that ADF conversion is used for any fields that accept rich text (descriptions, comments, worklogs)
- Validate that new functionality has corresponding Vitest tests
- Ensure commits follow Conventional Commits format

## Documentation Agent

When updating documentation:

- Keep the tools table in `README.md` in sync with tools defined in `src/index.ts`
- Update the "Developing" section if build steps or prerequisites change
- Use concise, direct language matching the existing README tone
