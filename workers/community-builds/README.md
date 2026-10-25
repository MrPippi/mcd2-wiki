# Community builds API

The Cloudflare Worker behind `/<lang>/builds/` (community builds) and the publish form on the build page. The site is static on GitHub Pages; this Worker and its D1 database are the only server parts.

- URL: `https://mcd2-wiki-builds.jack3555tw.workers.dev`
- D1 database: `mcd2-wiki-builds` (`a41885c6-0c73-448b-9566-f9927f36c343`), tables in `schema.sql`
- Turnstile widget: `mcd2-wiki-builds`, site key `0x4AAAAAAFlOn_tyotwdoz0w` (domains `mrpippi.github.io`, `localhost`)

## API

| Method | Path | Body | Answer |
| --- | --- | --- | --- |
| GET | `/builds?sort=top\|new&page=0` | | `{ builds, more }`, 30 per page, hidden builds left out |
| POST | `/builds` | `{ code, title, lang, token }` | 201 `{ id }`; 409 `exists` (with `id`) or `hidden`; 429 `rate` (5 per IP per hour) |
| POST | `/builds/<id>/vote` | `{ voter, token }` | `{ votes }`; one like per browser id |
| POST | `/builds/<id>/report` | `{ voter, token }` | `{ votes }`; 3 reports hide the build |
| DELETE | `/builds/<id>` | header `Authorization: Bearer <ADMIN_TOKEN>` | `{ deleted }` |

`token` is a Turnstile token; `voter` is a random id the browser keeps in localStorage. The Worker stores only salted SHA-256 hashes of IPs and voter ids. `code` is the build page's query string, normalized by `src/validate.ts` (only the build parameters, in a fixed order); the same build is stored once. Titles are 1–40 characters without links or `<>`.

## Settings

| Name | Kind | What |
| --- | --- | --- |
| `DB` | D1 binding | the database above |
| `ALLOWED_ORIGINS` | plain text | origins that get CORS headers: `https://mrpippi.github.io,http://localhost:4321,http://localhost:4329` |
| `TURNSTILE_SECRET` | secret | the widget's secret key |
| `HASH_SALT` | secret | random salt for the stored hashes; changing it resets who has liked what |
| `ADMIN_TOKEN` | secret | bearer token for DELETE |

## Deploy

`wrangler.toml` holds the same settings. With [wrangler](https://developers.cloudflare.com/workers/wrangler/) logged in to the account, and `database_id` filled in:

```bash
cd workers/community-builds
npx wrangler d1 execute mcd2-wiki-builds --remote --file schema.sql   # only for a new database
npx wrangler secret put TURNSTILE_SECRET   # likewise HASH_SALT and ADMIN_TOKEN
npx wrangler deploy
```

The first deploy (2026-10-25) was made through the Cloudflare API with the same bundle (`esbuild src/index.ts --bundle --format=esm`).

## Moderation

Reported builds hide themselves at three reports. To see or remove builds, query D1 in the Cloudflare dashboard (`SELECT id, title, reports, hidden FROM builds ORDER BY reports DESC`), and delete one with:

```bash
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" https://mcd2-wiki-builds.jack3555tw.workers.dev/builds/<id>
```

To show a hidden build again: `UPDATE builds SET hidden = 0, reports = 0 WHERE id = '<id>'` and `DELETE FROM reports WHERE build_id = '<id>'`.

## Tests

`tests/unit/workers/community-builds.test.ts` runs the handlers on `node:sqlite` with the same `schema.sql` (`tests/helpers/sqlite-d1.ts` stands in for D1).
