# 🐿️ Stashly

> Like a squirrel stashing treasures — Stashly collects your starred Slack messages into a Canvas automatically.

**Stashly** is a Slack app that collects messages with a specific emoji reaction and organizes them into a Slack Canvas, grouped by channel and date.

> 🌐 [日本語版はこちら (Japanese README)](README.ja.md)

---

## ✨ Features

- **Emoji-based collection** — Specify any emoji, and Stashly finds all messages with that reaction
- **Multi-channel support** — Search across up to 10 channels in one command
- **Date range filtering** — Limit results to the past N days (up to 365)
- **Auto-organized Canvas** — Results are grouped by channel and date, appended to a dedicated Canvas per emoji
- **Re-run to append** — Running the same command again adds new content to the existing Canvas
- **7 languages** — Responds in your Slack language setting automatically

---

## 🚀 Add to Slack

> ⚠️ Stashly is currently in **beta**. Please reach out to the developer for an install link.

**Requirements:**
- Slack **Pro plan or above** (Canvas feature required)
- The bot must be **invited to the channels** you want to collect from

---

## 📖 How to Use

### Basic — collect from the current channel

```
/canvas-collect :emoji:
```

### Specify channels

```
/canvas-collect :emoji: #channel1 #channel2
```

Up to 10 channels (including the current one).

### Filter by date range

```
/canvas-collect :thumbsup: last 7 days
```

### Combine options

```
/canvas-collect :star: #general #random last 30 days
```

---

### Period Syntax (all 7 languages work)

| Language | Example |
|---|---|
| English | `last 7 days` |
| Japanese | `過去7日` |
| Hindi | `पिछले 7 दिन` |
| French | `derniers 7 jours` |
| Spanish | `últimos 7 días` |
| Chinese | `过去7天` |
| Korean | `최근 7일` |

---

## 📋 Canvas Output Example

Stashly creates (or updates) a Canvas titled `:emoji: Collection Log` in the channel where you ran the command:

```
## :thumbsup: Collection Log
Last updated: 2026-01-15 09:00 (UTC)
Messages collected: 5
Target channels: 2

### #general
**2026-01-14**
- 10:45 (UTC) [View message](https://...)
- 11:30 (UTC) [View message](https://...)

### #random
**2026-01-15**
- 09:15 (UTC) [View message](https://...)
```

---

## 🌐 Supported Languages

Stashly automatically detects your language from your Slack profile settings.

English · Japanese · Hindi · French · Spanish · Chinese (Simplified) · Korean

---

## 💬 Beta Feedback

Stashly is in **beta** — your feedback helps a lot!

- **Bug reports & feature requests:** [Open a GitHub Issue](https://github.com/AGUREUNI/Stashly-app/issues/new/choose)

When reporting a bug, please include:
1. The exact command you ran (e.g. `/canvas-collect :thumbsup: #general last 7 days`)
2. What you expected to happen
3. What actually happened (copy any error message)
4. Your Slack plan (Free / Pro / Business+)

---

## 🔒 Privacy

- Stashly reads only messages with the specified emoji reaction
- **Message content is not stored** — only links (permalinks) are written to the Canvas
- Bot tokens are encrypted at rest (AES-256-GCM)
- Uninstall at any time from **Slack Settings → Manage Apps**

---

## 🛠️ For Developers

<details>
<summary>Local development setup</summary>

### Requirements

- Node.js >= 20.0.0
- npm
- PostgreSQL (for OAuth mode)

### Setup

```bash
npm install
cp .env.example .env
# Fill in your .env values
```

### Run

```bash
npm run build && node dist/app.js
```

### Test

```bash
npm test
npm run test:coverage
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SLACK_BOT_TOKEN` | Socket/Single-tenant | Bot token (xoxb-) |
| `SLACK_SIGNING_SECRET` | All modes | Signing secret |
| `SLACK_APP_TOKEN` | Socket mode | App token (xapp-) |
| `SLACK_CLIENT_ID` | OAuth mode | OAuth client ID |
| `SLACK_CLIENT_SECRET` | OAuth mode | OAuth client secret |
| `SLACK_STATE_SECRET` | OAuth mode | CSRF prevention secret |
| `DATABASE_URL` | OAuth mode | PostgreSQL connection URL |
| `ENCRYPTION_KEY` | OAuth mode | 64-char hex key for AES-256-GCM |
| `PORT` | HTTP mode | Server port (default: 3000) |

### Startup Modes

| Mode | Triggered when | Use case |
|---|---|---|
| Socket Mode | `SLACK_APP_TOKEN` is set | Local development |
| OAuth Mode | `SLACK_CLIENT_ID` is set | Production multi-tenant |
| HTTP Single-tenant | Neither above | Simple single-workspace deploy |

</details>

---

## 📄 License

MIT
