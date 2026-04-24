# AI Virtual Girl Assistant

Frontend-only app (React + Tailwind + Vite) with a lightweight PHP API inside `frontend/php-api`.

## Project structure

- `frontend/`
  - `src/` UI
  - `php-api/` PHP auth/chat/admin/voice endpoints + JSON data store

## Prerequisites

- Node.js 18+
- PHP 8+

## Run locally (no CORS issue)

1. Start PHP API server from project root:
   `php -S 127.0.0.1:8000 -t frontend`
2. Start frontend dev server:
   `cd frontend && npm install && npm run dev`
3. Open `http://127.0.0.1:5173`

Vite proxies `/php-api/*` to `http://127.0.0.1:8000` by default, so browser CORS errors do not appear in development.

## API notes

- Auth: `/php-api/auth/login.php`, `/php-api/auth/signup.php`, `/php-api/auth/me.php`
- Chat: `/php-api/chat/message.php`, `/php-api/chat/history.php`
- Admin: `/php-api/admin/stats.php`
- Voice: `/php-api/voice/transcribe.php` (stub response)
- Health: `/php-api/health.php`

## Data storage

- Runtime data is stored in `frontend/php-api/data/store.json`.
- Reference SQL schema from old backend is kept at `frontend/php-api/data/schema.sql`.
