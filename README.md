Kite server (TypeORM + TypeScript)

Local run:

1. Copy `.env.example` to `.env` and edit settings.
2. `npm install`
3. `npm run build`
4. `npm start`

Development:

`npm run dev`

Dockerized `server 0` run:

1. Keep using the existing `.env`.
2. From this directory run `npm run docker:server0:up`
3. Follow logs with `npm run docker:server0:logs`

Notes:

- The compose file publishes the app port with `ports:`.
- Because your current env uses `DB_HOST=localhost`, the container overrides that to `host.docker.internal` by default so it can still reach the Postgres instance running on the host.
- If you need a different host target, set `DOCKER_DB_HOST=...` before `docker compose up`.
- The service name is `server-0` and the container name is `trading-server-0` to mirror the current PM2 `server 0` role.
