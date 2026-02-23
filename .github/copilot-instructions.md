# Copilot Instructions

## Project Overview

This is **jira-mcp**, an MCP (Model Context Protocol) server that exposes Jira functionality as tools for Copilot and other MCP-compatible agents. It communicates over stdio and targets Jira Cloud with basic-auth API tokens.

## Tech Stack

- **Language:** TypeScript (ES2022, Node16 modules)
- **Runtime:** Node.js 22+
- **Framework:** `@modelcontextprotocol/sdk` for MCP server/transport
- **Build:** `tsc` (no bundler)
- **Tests:** Vitest
- **CI/CD:** GitHub Actions with semantic-release
- **Package Registry:** GitHub Packages (npm) and npmjs.com

## Project Structure

- `src/index.ts` — MCP server entry point; defines all tools and starts the stdio transport
- `src/jira-client.ts` — Lightweight Jira REST API client using native `fetch`
- `src/adf.ts` — Helpers to convert between plain text and Atlassian Document Format (ADF)
- `src/*.test.ts` — Vitest test files colocated with source

## Coding Conventions

- Use ESM (`import`/`export`) — no CommonJS
- File extensions in imports must be `.js` (TypeScript Node16 module resolution)
- Prefer `async`/`await` over raw Promises
- Use native `fetch` — no axios or other HTTP libraries
- Keep dependencies minimal; avoid adding new ones when the standard library suffices
- Use Vitest's `vi.spyOn(globalThis, "fetch")` for mocking HTTP in tests
- Test files use the `.test.ts` suffix and live alongside source files in `src/`

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) — semantic-release uses them to determine version bumps:

- `feat:` — new feature (minor bump)
- `fix:` — bug fix (patch bump)
- `chore:`, `docs:`, `refactor:`, `test:` — no release

## Common Tasks

```sh
npm install       # install dependencies
npm run build     # compile TypeScript
npm run dev       # watch mode
npm test          # run tests once
npm run test:watch # run tests in watch mode
```
