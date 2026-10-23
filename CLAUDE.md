# Fork notes (cc-providers)

Project rules live in `AGENTS.md`; this file only adds what that file and the scripts don't say.

## Driving the dev app over CDP

Use CDP to check rendered UI yourself before handing it to the user: navigate, measure, screenshot.

- `pnpm dev` logs `[orca-dev] Remote debugging on http://127.0.0.1:<port>`. The port is picked per worktree, so read it from the log.
- `GET http://127.0.0.1:<port>/json/list`; the main renderer is the `page` target whose `url` starts with `http://localhost:5173`. Connect to its `webSocketDebuggerUrl` with Node's global `WebSocket` (no dependencies).
- `Runtime.evaluate` with `{ returnByValue: true, awaitPromise: true }` drives the UI: click a settings nav item by its text, select a row, read `#id` elements, compare `scrollHeight` with `clientHeight` to catch clipped panes.
- `Page.captureScreenshot` shows the layout, then `Read` the PNG. It works on hidden windows too.
- `Runtime.enable` plus `Runtime.consoleAPICalled` events read the console, e.g. `[vite] hot updated: …` confirms an edit reached the window.
- Keep these probe scripts in the scratchpad; they are throwaway.

## HMR on this machine

The repo sits on `/Volumes/ssd2t`, a firmlinked volume whose FSEvents report paths under `/Volumes/ssd2t - Data`. Vite's watcher drops those events, so renderer edits never hot-reload and Cmd+R serves the cached module. After editing renderer code, restart `pnpm dev`. To tell a stale cache from a real bug, fetch `http://localhost:5173/src/<path>` with and without `?t=<now>` and compare.
