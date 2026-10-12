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

## Switching providers and models

Open session settings by clicking the model in the chat header. With an updated
continuous host, the picker lists models across providers configured on that
host. Each row shows its provider, and search accepts provider names as well as
model IDs. Selecting a model closes the dropdown. Click the selected model to
reopen it. Session settings stay open so you can adjust reasoning and instructions,
then click Save to apply the provider and model together without restarting the
host or creating another conversation.

Credentials stay on the host. Sign in there through zot's `/login`, set the
provider's API key environment variable before starting the host, or configure
its local/custom connection. Stored credential commands are not executed merely
to populate the list. Invalid selections or credential failures are shown as
errors without saving the new selection. Existing history is retained, and new
requests use the saved provider. A request already in flight uses its original
provider. Existing subagents keep their own selection.

Older hosts retain their single-provider picker. Both the host binary and the web
UI need updating to enable cross-provider selection.

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
- The model picker uses the host's active catalog. It does not provide login flows or live model discovery controls. Older hosts only allow models from their configured provider.
- No file browser or terminal panel. The host protocol does not expose them.

## Local development

```sh
bun install
zot continuous serve --store ~/.zot-store --web 127.0.0.1:7787
bun run dev        # http://localhost:3000, host URL ws://127.0.0.1:7787
bun run typecheck && bun run lint && bun test && bun run build
```
