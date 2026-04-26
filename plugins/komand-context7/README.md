# Context7 (Komand)

Fetch up-to-date library documentation via the [Context7 CLI](https://github.com/upstash/context7)
before answering questions about any framework, SDK, or API.

## What it does

Adds a `library-docs` skill that teaches the agent to call `npx ctx7@latest`
whenever the user asks about a specific library, framework, SDK, API, or
CLI tool — even ones the model thinks it already knows. Training data goes
stale; this fetches the current docs straight from Context7.

## Workflow

Two-step: resolve a library name to an ID, then query docs against that ID.

```bash
# Step 1 — resolve
npx ctx7@latest library next.js "App Router data fetching"
# → /vercel/next.js

# Step 2 — fetch
npx ctx7@latest docs /vercel/next.js "App Router data fetching server components"
```

If the user provides a `/org/project` ID directly, skip step 1.

## Why CLI instead of MCP

Pure CLI invocation works anywhere Node is available — no MCP server to
register, no extra config, no separate auth flow. The skill is just
instructions; the binary comes from npm via `npx`.

For higher quotas, users can run `npx ctx7@latest login` once or set
`CONTEXT7_API_KEY` in their environment.

## When the agent uses this

Triggers on any user question that names a specific library / framework
/ SDK / CLI / cloud service, including API syntax, configuration,
version migration, library-specific debugging, setup, and CLI usage.

Skips for: refactors, scripts from scratch, business-logic debugging,
code review, general programming concepts.

## License

MIT.
