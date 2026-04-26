---
name: library-docs
description: Fetch current library, framework, SDK, API, or CLI documentation via the Context7 CLI before answering. Use whenever the user asks about a specific tech (React, Next.js, Prisma, Tailwind, Django, Spring Boot, etc.) — even ones you think you know — including API syntax, configuration, version migration, library-specific debugging, setup, and CLI usage. Skip for refactors, scripts from scratch, business-logic debugging, code review, or general programming concepts.
version: 1.0.0
license: MIT
---

# Library Docs (Context7 CLI)

Use the `ctx7` CLI to fetch current documentation whenever the user asks
about a library, framework, SDK, API, CLI tool, or cloud service — even
well-known ones. Your training data may not reflect recent changes.
Prefer this over web search for library docs.

## When to use

Always use this skill when the user asks about:

- A specific library, framework, SDK, or CLI tool by name (React, Next.js,
  Prisma, Express, Tailwind, Django, Spring Boot, etc.)
- API syntax, function signatures, or configuration options
- Version migration or breaking changes between versions
- Library-specific debugging
- Setup or installation instructions
- CLI tool usage and flags

Use this **even when you think you know the answer**. API details and
configuration options change frequently and your training data may be
out of date.

## When NOT to use

Skip for:

- Refactoring or restructuring existing code
- Writing scripts or programs from scratch
- Debugging business logic (not library behavior)
- Code review
- General programming concepts (algorithms, design patterns, language
  fundamentals)

## The two-step workflow

### Step 1 — Resolve the library to an ID

```bash
npx ctx7@latest library <name> "<the user's question>"
```

Returns ranked matches in `/org/project` form. Pick the best one by:

1. **Exact name match** in `title`
2. **Description relevance** to the question
3. **Code snippet count** (`totalSnippets`) — more is usually better
4. **Source reputation** — `trustScore` 7+ preferred
5. **Benchmark score** — higher is better when scores differ meaningfully

If the results don't look right, try alternate names or rephrase the
query (e.g., `next.js` not `nextjs`, or split into two specific queries).

### Step 2 — Fetch docs against that ID

```bash
npx ctx7@latest docs <libraryId> "<the user's question>"
```

Use the `/org/project` ID from step 1. The query should be **specific
and detailed** — full questions return better results than vague single
words.

### Version-pinned docs

Some libraries publish per-version snapshots. The `library` output
includes a `versions` array. To pin:

```bash
npx ctx7@latest docs /vercel/next.js/v14.3.0 "useEffect dependency rules"
```

## Direct ID

If the user provides an ID in `/org/project` form, skip step 1 and call
`docs` directly.

## JSON output for parsing

Both subcommands accept `--json` for machine-readable output:

```bash
npx ctx7@latest library react --json
npx ctx7@latest docs /facebook/react "useState" --json
```

Use this if you need to programmatically pick a match (e.g., filter by
`benchmarkScore > 80`).

## Retrying with `--research`

If the first answer didn't satisfy the user, retry with `--research`:

```bash
npx ctx7@latest docs <libraryId> "<question>" --research
```

This spins up sandboxed agents that read the actual source repos and
runs a live web search before synthesizing a fresh answer. Costs more
than the default — use only on retry.

## Hard rules

- **Call `library` first** to get a valid ID. The only exception is when
  the user provided a `/org/project` ID directly.
- Use the user's full question as the query. Specific, detailed queries
  return better results.
- **Do not run more than 3 commands per question.** If three calls
  haven't produced a useful answer, fall back to other approaches and
  tell the user what you tried.
- **Never include sensitive data** (API keys, passwords, credentials,
  internal URLs) in queries. Queries are sent to the Context7 service.

## Quota and authentication

If a command fails with a quota error, tell the user to either:

- Run `npx ctx7@latest login` for higher limits, or
- Set `CONTEXT7_API_KEY` env var with their API key

**Do not silently fall back to training data.** If the docs fetch fails,
say so and let the user choose how to proceed.

## Examples

```bash
# User: "How do I configure middleware in Next.js 15?"
npx ctx7@latest library next.js "middleware configuration"
# → /vercel/next.js
npx ctx7@latest docs /vercel/next.js "middleware configuration in Next.js 15"

# User: "What's the new App Router data fetching pattern?"
npx ctx7@latest library next.js "App Router data fetching"
# → /vercel/next.js
npx ctx7@latest docs /vercel/next.js "App Router data fetching server components"

# User-supplied ID
# User: "Show me Prisma /prisma/prisma examples for many-to-many relations"
npx ctx7@latest docs /prisma/prisma "many-to-many relations"
```
