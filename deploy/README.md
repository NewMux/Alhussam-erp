# VPS + PocketBase hosting

This is the deployment guide for the managed-backend side of the business:
one shared VPS running a separate PocketBase instance per client, fronted by
Caddy, with automated off-site backups. The frontend and the Node/tRPC API
layer keep deploying to Vercel exactly as before (`vercel.json`,
`server/vercel.ts`) — nothing about that changes. Only the data store and
auth provider moved off Supabase and onto PocketBase.

```
Browser ──▶ Vercel (static frontend + /api/trpc serverless function)
                              │
                              ▼
              https://<client>.yourdomain.com  (Caddy, auto TLS)
                              │
                              ▼
                 PocketBase instance for that client
                     (127.0.0.1:<port>, own pb_data)
```

## One-time VPS setup

Recommended: Hetzner CX22 (~€4/mo) or similar. Debian/Ubuntu.

```bash
# PocketBase binary (check pocketbase.io/docs for the current release)
curl -sSL -o pocketbase.zip https://github.com/pocketbase/pocketbase/releases/download/vX.Y.Z/pocketbase_X.Y.Z_linux_amd64.zip
sudo mkdir -p /opt/pocketbase
sudo unzip pocketbase.zip -d /opt/pocketbase
sudo cp deploy/backup-pocketbase.sh /opt/pocketbase/backup-pocketbase.sh
sudo chmod +x /opt/pocketbase/pocketbase /opt/pocketbase/backup-pocketbase.sh

sudo useradd --system --home /srv/clients --shell /usr/sbin/nologin pocketbase
sudo mkdir -p /srv/clients /srv/backups /etc/pocketbase
sudo chown -R pocketbase:pocketbase /srv/clients /srv/backups

# Caddy (see caddyserver.com/docs/install)
sudo apt install -y caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile

# rclone, for off-site backups (see rclone.org/install)
curl https://rclone.org/install.sh | sudo bash
rclone config   # set up a remote, e.g. Backblaze B2 — name it once, reuse for every client

sudo cp deploy/pocketbase@.service deploy/pocketbase-backup@.service deploy/pocketbase-backup@.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

## Onboarding a new client

```bash
CLIENT=tailor-shop   # short slug, matches the systemd instance name and subdomain

# 1. Data directory + PocketBase instance
sudo -u pocketbase mkdir -p /srv/clients/$CLIENT/pb_data
sudo cp deploy/pocketbase.env.example /etc/pocketbase/$CLIENT.env
sudo $EDITOR /etc/pocketbase/$CLIENT.env   # pick a free PORT

sudo systemctl enable --now pocketbase@$CLIENT

# 2. Create the superuser PocketBase auth account (used by the Node server AND backups)
sudo -u pocketbase /opt/pocketbase/pocketbase superuser create owner@$CLIENT.example "$(openssl rand -base64 24)" --dir /srv/clients/$CLIENT/pb_data
# save that generated password — it goes into POCKETBASE_SUPERUSER_PASSWORD (Vercel env)
# and BACKUP_PB_SUPERUSER_PASSWORD (/etc/pocketbase/$CLIENT.env) below.
sudo $EDITOR /etc/pocketbase/$CLIENT.env   # fill in BACKUP_PB_SUPERUSER_EMAIL/PASSWORD, BACKUP_RCLONE_REMOTE

# 3. Bootstrap the collection schema (run from this repo, pointed at the new instance)
PB_URL=http://127.0.0.1:<PORT> \
PB_SUPERUSER_EMAIL=owner@$CLIENT.example \
PB_SUPERUSER_PASSWORD=<the generated password> \
pnpm pocketbase:schema

# 4. DNS: point $CLIENT.yourdomain.com at this VPS, then add a block to
#    /etc/caddy/Caddyfile (see the commented example already in that file)
sudo systemctl reload caddy

# 5. Nightly backups
sudo systemctl enable --now pocketbase-backup@$CLIENT.timer

# 6. On Vercel, set for this client's project:
#    POCKETBASE_URL=https://<client>.yourdomain.com
#    POCKETBASE_SUPERUSER_EMAIL / POCKETBASE_SUPERUSER_PASSWORD (from step 2)
#    VITE_POCKETBASE_URL=https://<client>.yourdomain.com
#    OWNER_EMAIL=<the shop owner's real sign-in email>
```

One shared VPS comfortably hosts a dozen-plus shops this size before it
needs upgrading — repeat "Onboarding a new client" for each one.

## Moving an existing client off Supabase

Only needed once, for the tailor shop's live data:

```bash
DATABASE_URL=<the old Supabase Postgres connection string> \
PB_URL=https://<client>.yourdomain.com \
PB_SUPERUSER_EMAIL=owner@$CLIENT.example \
PB_SUPERUSER_PASSWORD=<the generated password> \
pnpm pocketbase:migrate-data
```

This writes `migration-credentials.json` with a random temporary password
per migrated user (Supabase and PocketBase hash passwords differently, so
old passwords can't be carried over). Distribute those privately — a phone
call, not email/Slack — and delete the file once everyone has signed in and
changed their password. **Known limitation:** multi-step writes (a POS
checkout's sale + stock deduction + invoice, for example) are a sequence of
plain PocketBase writes, not a single database transaction — there is no
transaction API reachable from this Node client. For a single shop with one
till this is a low-probability edge case (a mid-checkout crash), and every
step is audit-logged, but it's worth knowing before pointing a second,
higher-volume client at this same architecture.

## Restoring from backup

```bash
sudo systemctl stop pocketbase@$CLIENT
sudo -u pocketbase unzip -o /path/to/backup.zip -d /srv/clients/$CLIENT/pb_data
sudo systemctl start pocketbase@$CLIENT
```
