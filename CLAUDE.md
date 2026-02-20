# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Dev server (custom Node + Socket.IO via tsx watch server.ts)
npm run build            # Production build (next build)
npm run lint             # ESLint
npm run seed:landmarks   # Seed landmark data (tsx scripts/seed-landmarks.ts)

# Database migrations (requires DATABASE_URL in env)
npx drizzle-kit generate # Generate migration SQL from schema changes
npx drizzle-kit migrate  # Apply pending migrations
```

## Architecture

**iskomunidad** is a university social platform (Reddit-style posts, real-time messaging, campus events, gig listings, landmark map) built as a PWA with Next.js App Router.

### Custom Server

`server.ts` runs a custom Node HTTP server wrapping Next.js to support Socket.IO WebSockets. The dev command is `tsx watch server.ts`, not `next dev`. Socket.IO handles real-time messaging (typing indicators, message delivery, read receipts) with auth middleware that validates Better Auth session tokens directly against the DB.

### Route Groups

- `(auth)` — sign-in, sign-up, verify-email, reset-password, forgot-password
- `(explorer)` — main app, wrapped in `SocketProvider` + `ConsentGate` (legal consent blocker)
- `admin/` — moderation dashboard (protected by `requireAdmin()`)

### Data Flow Pattern

**Mutations**: Client form → server action (in `src/actions/`) → returns `ActionResult<T>`
**Queries**: Server actions called from client via TanStack Query (`useQuery`/`useInfiniteQuery`)
**Real-time**: Socket.IO events for typing, messages, read status (via `SocketProvider` context)

Every server action follows this pattern:
```typescript
export async function doThing(input): Promise<ActionResult<T>> {
  const session = await getSession();        // auth check
  if (!session) return { success: false, error: "..." };
  const limited = await guardAction("action.name", { contentBody }); // abuse guard
  if (limited) return limited;
  // ... business logic
  return { success: true, data: result };
}
```

Shared helpers in `src/actions/_helpers.ts`: `getSession()`, `getOptionalSession()`, `requireAdmin()`, `rateLimit(tier)`, `guardAction(action, opts)`, `guardActionWithDecision()`, `createNotification()`, `createUserNotification()`.

### Auth (Better Auth)

Configured in `src/lib/auth.ts` with username + magic link plugins. Client utilities in `src/lib/auth-client.ts`. Schema in `src/lib/auth-schema.ts`.

User table has `role` ("user" | "admin"), `status` ("active" | "banned" | "deleted"), and `university` fields beyond Better Auth defaults. `getSession()` auto-revokes sessions for non-active users.

Direct signup via the auth API is blocked in `src/app/api/auth/[...all]/route.ts` — signup must go through server actions that record legal consent.

### Database (Drizzle ORM + PostgreSQL)

**Schema files**: `src/lib/schema.ts` (app tables), `src/lib/auth-schema.ts` (auth tables)
**Client**: `src/lib/db.ts` (pg Pool + drizzle)
**Config**: `drizzle.config.ts`

Key domain tables: `communityPost`, `postImage`, `postComment`, `postVote`, `commentVote`, `campusEvent`, `eventRsvp`, `gigListing`, `gigSwipe`, `landmark`, `landmarkPhoto`, `landmarkReview`, `conversation`, `message`, `conversationParticipant`, `messageRequest`, `cmSession`/`cmMessage`/`cmQueueEntry` (Campus Match), `abuseEvent`, `adminSetting`, `userNotification`.

All tables have Drizzle relations defined — use `db.query.tableName.findFirst/findMany({ with: { ... } })` for eager loading.

#### Migration Workflow

1. Edit schema in `src/lib/schema.ts` or `auth-schema.ts`
2. `npx drizzle-kit generate` — creates `.sql` in `drizzle/` and updates `drizzle/meta/_journal.json`
3. Review generated SQL. For **data migrations** (UPDATE/INSERT), append manually using `--> statement-breakpoint` as separator
4. `npx drizzle-kit migrate` — applies to DB (needs `DATABASE_URL`)
5. `npm run build` to verify types

**Never use `drizzle-kit push`** — it bypasses migration history and can drop columns.

Migrations tracked in `drizzle.__drizzle_migrations` (the `drizzle` schema, not `public`). Uses SHA256 hashes and timestamp-based ordering from `_journal.json`.

If migrate fails with "already exists" errors, bootstrap the entry:
```sql
-- Hash: node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('drizzle/XXXX.sql','utf8')).digest('hex'))"
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('<sha256>', <journal-when-value>);
```

### Anti-Abuse System (Two Layers)

**Layer 1 — In-memory rate limiter** (`src/lib/rate-limit.ts`): Fixed-window per IP. Tiers: `auth`, `create`, `upload`, `proxy`, `general`.

**Layer 2 — Redis-backed abuse guard** (`src/lib/abuse/`): Multi-rule policy engine with 19 action-specific policies, content deduplication, identity fingerprinting (user/IP/device/email via HMAC-SHA256). Decisions: `allow` | `throttle` | `deny` | `degrade_to_review`. Fails open if Redis is down. Supports shadow mode (`ABUSE_MODE=shadow`).

Policies defined in `src/lib/abuse/policies.ts`. Apply via `guardAction()` in server actions or `guard()` directly in API routes/sockets.

### Content Moderation

Three approval modes (stored in `adminSetting`): `auto` (instant publish), `manual` (admin review), `ai` (OpenAI moderation via `src/lib/ai-moderation.ts` with strict/moderate/relaxed presets). Posts/events/gigs created with `status: "draft"` when not auto-approved.

### File Storage (Tigris/S3)

Upload flow: client → `POST /api/upload` (validates type + size, uploads to S3) → returns `{ key }` → key stored in DB → served via `GET /api/photos/[...key]` (presigned URL proxy).

Client-side compression in `src/lib/image-compression.ts`. Reusable `PhotoUpload` component at `src/components/admin/photo-upload.tsx`. Max 5MB, JPEG/PNG/WebP/GIF.

### UI

Tailwind CSS v4 + shadcn/ui components in `src/components/ui/`. Custom fonts: Satoshi, Cabinet Grotesk, Hoover, Geist Mono. Icons via lucide-react. Toasts via sonner.
