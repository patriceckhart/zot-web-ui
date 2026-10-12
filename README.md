# zot browser client

A browser client for `zot continuous`. It lists sessions, opens workspaces, streams answers, shows tool calls, steers or queues messages, stops runs, decides approvals, attaches images and files, and changes model and reasoning.

The UI is a static Next.js export with no server code, made to be deployed on Vercel. Host URL and token are kept only in the tab's `sessionStorage` and are sent only to the host you enter.

```
browser (anywhere)  --wss-->  tailscale / cloudflared  -->  zot continuous serve --web (your Mac)
```

## 1. Deploy the UI

```sh
bunx vercel deploy --prod
```

No environment variables are needed.

## 2. Start zot on your Mac

```sh
zot continuous serve --store ~/.zot-store --web 127.0.0.1:7787 --web-origin https://<your-app>.vercel.app
```

`--web` opens a WebSocket endpoint next to the local socket and prints the web token. Without `--token-file`, the token is stored in `~/.zot-store/web-token` (mode 0600) and stays the same across restarts. Delete the file to rotate it. Ordinary zot flags (`--provider`, `--model`, `--cwd`, `--tools`) work as usual.

## 3. Expose it over HTTPS

A page served over HTTPS can only connect to `wss://`. Keep `--web` on loopback and put a TLS tunnel in front:

**Tailscale** (only devices in your tailnet can reach it):

```sh
tailscale serve --bg --https=443 http://127.0.0.1:7787
```

Host URL: `wss://<mac-name>.<tailnet>.ts.net`

**Cloudflare quick tunnel** (public URL, changes on every start):

```sh
cloudflared tunnel --url http://127.0.0.1:7787
```

Host URL: `wss://<random>.trycloudflare.com`. For a stable hostname, use a named tunnel with `ingress: service: http://127.0.0.1:7787`. Cloudflare Access can add a login in front of it.

## 4. Connect

Open the UI, add the host URL and the web token, and open a workspace (for example `main`). The same workspace works from the terminal:

```sh
zot --continuous ~/.zot-store/host.sock --continuous-workspace main
```

## Subagents

The sidebar nests subagent conversations under the conversation that created them,
including children of subagents. Use the arrow beside a parent to collapse or
expand its children. All branches start expanded, and expansion state lasts until
you disconnect or reload. Click any conversation to open its transcript. Model
and activity indicators remain visible on each row.

The list refreshes every 15 seconds. Search results stay flat so matching children
remain accessible even when their parent is collapsed. If a parent is absent from
the loaded list, its child appears at the top level. Forks remain separate top-level
conversations. This display uses existing host ownership metadata and requires no
host configuration changes.

## Security

- The web token grants full control of the agent on your Mac, including shell tools. Treat it like an SSH key.
- Prefer Tailscale: the endpoint is not public. A cloudflared URL is reachable by anyone on the internet, so the token is the only protection unless you add Cloudflare Access.
- `--web-origin` only stops other websites from connecting in a browser. Non-browser clients can send any origin.
- With `--token-file`, the web endpoint accepts those tokens and their roles. The UI respects the role it receives (`read` cannot send, only `approve` and `admin` decide approvals, only `admin` stops runs).

## Limitations

- The host stores workspace names hashed. Names opened in this browser session are remembered, other conversations show as `conversation <id>`.
- The newest 400 entries of a conversation are loaded.
- The model is entered as an ID. The host refuses providers other than the one it was started with.
- No file browser or terminal panel. The host protocol does not expose them.

## Local development

```sh
bun install
zot continuous serve --store ~/.zot-store --web 127.0.0.1:7787
bun run dev        # http://localhost:3000, host URL ws://127.0.0.1:7787
bun run typecheck && bun run lint && bun test && bun run build
```
