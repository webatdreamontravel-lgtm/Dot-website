# Production deployment

Every push to the **`production`** branch builds the app, archives the build to
S3, and releases it into the existing app directory on EC2, reloading the PM2
process that already runs there.

```
push to production
   │
   ├─ build ──────────────────────────────────────────────────────────────
   │    .env written from the PRODUCTION_ENV secret
   │    npm ci  →  prisma migrate deploy  →  next build
   │    .next/standalone + .next/static + public  →  release.tar.gz (~17 MB)
   │    →  s3://$S3_BUCKET/releases/<timestamp>-<sha>.tar.gz
   │
   └─ deploy ─────────────────────────────────────────────────────────────
        .env  ──scp──▶  ~/.dot-production.env   (outside the app dir)
        presign the S3 object (1 h)
        SSH in:
           curl the tarball  →  unpack to <app-dir>.incoming
           copy .env in, carry over your ecosystem file
           swap:  <app-dir> → <app-dir>.previous,  .incoming → <app-dir>
           pm2 reload <your-app-name>
           poll /api/health  →  swap .previous back if it fails
```

Everything lives in one file: [.github/workflows/deploy-production.yml](../.github/workflows/deploy-production.yml).
There is no deploy script on the box and nothing to install there beyond what
you already have.

**Your PM2 setup is not modified.** The workflow reloads your process by name
and never writes an ecosystem file. Your existing config is copied across the
directory swap so it survives.

---

## What the pipeline assumes about your box

Three things, all of which are already true of a standard `npm start` setup:

1. **A PM2 process registered by name**, whose `cwd` is the app directory.
   Check with `pm2 list` — the name goes in the `PM2_APP_NAME` variable.
2. **That process runs `npm start`** (or `npm run start`). The bundle ships a
   `package.json` whose `start` is rewritten to `node server.js`, so the same
   command now boots Next's standalone server. If your config instead calls
   `next` directly — e.g. `script: node_modules/next/dist/bin/next` — change it
   to `script: npm, args: start` before the first deploy, or it will break.
3. **Node ≥ 20.9 on the deploy user's PATH for non-login SSH sessions.**
   `ssh host bash -s` does not source your profile. If nvm installed itself
   below an interactive-only guard in `~/.bashrc`, move these lines above it:

   ```bash
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
   ```

   Verify with `ssh <user>@<host> 'which node pm2'` — if that prints nothing,
   the deploy will fail with a clear error rather than half-deploying.

### Two behaviours worth knowing

- **`PORT` must come from PM2's `env`, not from `.env`.** The standalone server
  reads `process.env.PORT` before Next loads env files, so a `PORT=` line in
  the secret is ignored and the app falls back to 3000. Everything else —
  `DATABASE_URL`, Supabase keys, Resend — *is* read from `.env` in the app
  directory at boot, which is where the workflow puts it.
- **Only `npm start` works in the deployed bundle.** `node_modules` is the
  traced production subset, so `npm run db:seed`, `make-admin`, and anything
  using `tsx` are not available on the box. Run those from a full checkout —
  your machine, against the production database.

---

## 1. One-time AWS setup

### S3 bucket

```bash
aws s3 mb s3://dot-website-releases --region ap-south-1

# Releases are build artifacts, not public files. The EC2 box reads them
# through a presigned URL, never anonymously.
aws s3api put-public-access-block \
  --bucket dot-website-releases \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

Recommended — expire old artifacts so the bucket doesn't grow forever:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket dot-website-releases \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-old-releases",
      "Status": "Enabled",
      "Filter": {"Prefix": "releases/"},
      "Expiration": {"Days": 90}
    }]
  }'
```

### IAM user for GitHub Actions

Programmatic access only, no console login, and exactly this policy — nothing
broader:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublishReleases",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::dot-website-releases/releases/*"
    },
    {
      "Sid": "ListForPresign",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::dot-website-releases"
    }
  ]
}
```

```bash
aws iam create-user --user-name github-actions-dot-deploy
aws iam put-user-policy --user-name github-actions-dot-deploy \
  --policy-name dot-releases --policy-document file://policy.json
aws iam create-access-key --user-name github-actions-dot-deploy
```

Keep the `AccessKeyId` and `SecretAccessKey` — the secret is shown once.

> The EC2 instance needs **no AWS credentials**. The deploy job presigns the S3
> object and the box just `curl`s that URL, which stops working after an hour.

### Media bucket (trip photos)

Separate from the release bucket — different lifecycle, different access. This
one is read by the public, so it does **not** get the block-public-access
treatment above.

```bash
aws s3 mb s3://dot-website-media --region ap-south-1

# Allow public reads of uploaded photos only. Nothing else in the bucket is
# readable, and nothing is publicly writable.
aws s3api put-public-access-block --bucket dot-website-media \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false"

aws s3api put-bucket-policy --bucket dot-website-media --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadTripPhotos",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::dot-website-media/trips/*"
  }]
}'
```

The app writes and deletes; give its IAM user only that, scoped to the prefix:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "ManageTripPhotos",
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::dot-website-media/trips/*"
  }]
}
```

No CORS configuration is needed — the browser never talks to S3 directly.
Uploads go through `/api/admin/upload`, which is admin-gated.

> Photos uploaded before this change still live in Supabase Storage and are
> read from there. Nothing was migrated, so both hosts stay allowed in
> `next.config.ts` and the Supabase keys stay in `PRODUCTION_ENV`.

### EC2 security group

| Port | Source | Why |
|------|--------|-----|
| 22 | GitHub Actions egress, or `0.0.0.0/0` | the deploy job's SSH |
| 80 / 443 | `0.0.0.0/0` | public traffic |
| 3000 | **nobody** | the app should sit behind your proxy |

GitHub-hosted runners have no fixed IPs. Either allow `0.0.0.0/0` on 22 and
rely on key-only auth, or pull the current ranges from
`https://api.github.com/meta` (`.actions`) — that list changes, so automate the
refresh if you narrow the rule.

### Deploy key

Use a keypair dedicated to the pipeline, not your personal key:

```bash
# On your machine
ssh-keygen -t ed25519 -C "github-actions-dot-deploy" -f deploy_key -N ""

# Authorise the public half on the instance
ssh-copy-id -i deploy_key.pub <user>@<instance-ip>

# Pin the host key so the workflow never trusts-on-first-use
ssh-keyscan -H <instance-ip>
```

`deploy_key` (the **private** half, BEGIN/END lines included) becomes
`EC2_SSH_PRIVATE_KEY`. The `ssh-keyscan` output becomes `EC2_KNOWN_HOSTS`.
Delete your local copy of `deploy_key` afterwards.

---

## 2. GitHub secrets and variables

**Settings → Secrets and variables → Actions.**

### Secrets

| Name | Value |
|------|-------|
| `PRODUCTION_ENV` | The entire production `.env`, pasted verbatim. Same shape as `.env.example`, real values. |
| `AWS_ACCESS_KEY_ID` | From `aws iam create-access-key`. |
| `AWS_SECRET_ACCESS_KEY` | Ditto. |
| `EC2_HOST` | Public IP or DNS of the instance. |
| `EC2_SSH_PRIVATE_KEY` | Full private key PEM, BEGIN/END lines included. |
| `EC2_KNOWN_HOSTS` | Output of `ssh-keyscan -H <host>`. Optional — omitting it means trust-on-first-use and logs a warning. |

### Variables

| Name | Example | Notes |
|------|---------|-------|
| `AWS_REGION` | `ap-south-1` | |
| `S3_BUCKET` | `dot-website-releases` | Name only, no `s3://`. |
| `EC2_USER` | `ec2-user` | `ubuntu` on Ubuntu AMIs. |
| `EC2_APP_DIR` | `/var/www/dot` | **Your existing app directory** — the `cwd` in your PM2 config. |
| `PM2_APP_NAME` | `dot` | **Exactly as it appears in `pm2 list`.** |
| `APP_PORT` | `3000` | Port the app listens on, for the health check. |
| `EC2_SSH_PORT` | `22` | Optional, defaults to 22. |
| `EC2_ENV_PATH` | `~/.dot-production.env` | Optional. Where the `.env` is staged, outside the app dir. |
| `SITE_URL` | `https://dreamontravel.in` | Optional. Enables the post-deploy public check. |

### `PRODUCTION_ENV` contents

Everything in `.env.example` with real values. Required or the build fails
fast: `DATABASE_URL`, `DIRECT_URL`. Set `NEXT_PUBLIC_SITE_URL` to the real
domain.

Trip photo uploads additionally need:

```bash
AWS_REGION="ap-south-1"
AWS_S3_BUCKET="dot-website-media"
AWS_ACCESS_KEY_ID="..."          # the media IAM user, not the CI one
AWS_SECRET_ACCESS_KEY="..."
NEXT_PUBLIC_MAX_UPLOAD_MB="10"   # largest file a person may choose
NEXT_PUBLIC_MAX_STORED_MB="5"    # ceiling after compression
```

Two constraints:

- **`NEXT_PUBLIC_*` is baked in at build time.** Changing one requires a new
  build — re-running only the deploy job will not pick it up. Everything else
  is read at runtime, so a deploy-only re-run is enough.
- **Values cannot span multiple lines.** If you ever need a PEM, base64 it.

### Optional: require approval before deploying

The `deploy` job targets a GitHub Environment named `production`. Create it
under **Settings → Environments** and add yourself as a required reviewer —
builds run automatically, the release waits for a click. If you don't create
it, nothing breaks and deploys stay fully automatic.

---

## 3. First deploy

Before pushing, confirm the three assumptions:

```bash
ssh <user>@<host> 'which node pm2 && pm2 list'
```

Then:

```bash
git checkout production
git merge main
git push origin production
```

Watch it under **Actions**. On success:

```bash
curl -s https://dreamontravel.in/api/health
# {"status":"ok","release":"20260825-141530-a1b2c3d","uptime":12}
```

The `release` field is the build id, so you can always tell what is live.

---

## 4. Operating it

```bash
ssh <user>@<host>

pm2 status                    # is it up?
pm2 logs <app> --lines 100    # app logs
pm2 reload <app>              # graceful restart

ls -d /var/www/dot*           # app dir + the .previous rollback copy
```

### Manual rollback

The pipeline rolls back automatically on a failed health check. To revert a
deploy that *passed* health but is bad anyway, the previous directory is still
sitting there:

```bash
cd /var/www
rm -rf dot.rollback && mv dot dot.rollback
mv dot.previous dot
pm2 reload <app>
```

Then revert the commit on `production` so the next push doesn't reintroduce it.
Note only **one** previous directory is kept — a second deploy overwrites it.

### Rotating a secret

Update `PRODUCTION_ENV`, then re-run the latest workflow run. Re-running just
the `deploy` job is enough unless you changed a `NEXT_PUBLIC_*` value.

---

## 5. Troubleshooting

**`npm ci` fails: "package.json and package-lock.json are not in sync"**
Run `npm install` locally and commit the updated `package-lock.json`. `npm ci`
will not repair a stale lockfile — that is the point of it.

**`prisma migrate deploy` fails with `P3009`**
A previous migration failed halfway; Prisma applies nothing further until it is
resolved by hand:

```bash
npx prisma migrate resolve --rolled-back <migration_name>   # undo and retry
npx prisma migrate resolve --applied <migration_name>       # if it did apply
```

Then re-run. If a migration genuinely was applied out-of-band, unblock a
release with **Run workflow → skip_migrations**.

**Build fails collecting page data with `ECONNREFUSED`**
The runner cannot reach the database. `/trips/[slug]` prerenders from Prisma at
build time, so `DATABASE_URL` must be reachable **from GitHub's runners**, not
just from EC2. Usually a wrong password, a paused Supabase project, or network
restrictions enabled on it.

**`pm2 is not on PATH for this SSH session`**
See assumption 3 above — move the nvm lines above the interactive-only guard in
`~/.bashrc`.

**`No PM2 process named '<x>'`**
`PM2_APP_NAME` doesn't match `pm2 list`. The deploy stops before touching
anything, so nothing is broken.

**Health check fails and the deploy rolls back**
The workflow prints the last 60 lines of PM2 output before rolling back. Usual
causes: a variable missing from `PRODUCTION_ENV` (the endpoint returns 503 with
the reason), a wrong `APP_PORT`, or `PORT` set only in `.env` — see the note
above about PM2 owning `PORT`.

**Deploy hangs on `curl`, or "presigned URL may have expired"**
Presigned URLs last one hour. If the job sat waiting on an environment
approval that long, re-run it to mint a fresh URL.

---

## Files

| Path | Role |
|------|------|
| [.github/workflows/deploy-production.yml](../.github/workflows/deploy-production.yml) | The entire pipeline, remote script inlined. |
| [app/api/health/route.ts](../app/api/health/route.ts) | Health probe the deploy gates on. |
| [next.config.ts](../next.config.ts) | `output: "standalone"` — what makes the 17 MB artifact possible. |
