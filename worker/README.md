# Render worker

The final video render (ffmpeg) is the heaviest CPU work in the app. On Vercel it counts against Fluid
Active CPU (4 h/month on Hobby). This worker runs the exact same render code (`src/lib/render-job.ts`)
on a container host with cheaper CPU: **Fly.io** (set up below) or Google Cloud Run (at the end).

How it fits: `POST /api/scans/[id]/render` on Vercel creates the `jobs` row as before, then (when
`RENDER_WORKER_URL` is set) calls the worker and waits on the network, which uses no Active CPU. The worker
answers at once, sends a keep-alive space every 15 s, and finishes with `{"ok":true}`. Progress, cancel
and the result go to the same `jobs` row, so the browser and `/api/jobs/[id]` don't change.
Unset `RENDER_WORKER_URL` on Vercel to render on Vercel again.

## Fly.io

Config: `fly.toml` at the repo root (performance-2x, 4 GB, region `iad`, machines stop when idle,
one render per machine).

### 1. Install flyctl and sign in

```bash
brew install flyctl
fly auth signup        # or: fly auth login
```

### 2. Create the app

```bash
fly apps create fooddie-render
```

If the name is taken, pick another and change `app = ...` in `fly.toml` to match.

### 3. Add the secrets

Make `~/render.env` **outside the repo**, so it is never committed. Copy the values from
Vercel → fooddiescanner → Settings → Environment Variables:

```
RENDER_WORKER_SECRET=<output of: openssl rand -hex 32>
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_IMAGES_BUCKET=...
R2_VIDEOS_BUCKET=...
```

```bash
fly secrets import --stage < ~/render.env
```

Keep `RENDER_WORKER_SECRET`: Vercel needs the same value in step 5.

### 4. Deploy (from the repo root; repeat after render code changes)

```bash
fly deploy
curl https://fooddie-render.fly.dev/healthz     # → {"ok":true}
```

Fly builds `worker/Dockerfile` on its own builders. After the check passes, the machines stop when
idle, so you only pay while a render runs.

### 5. Switch Vercel over

In the fooddiescanner project's environment variables (Production), add:

- `RENDER_WORKER_URL` = `https://fooddie-render.fly.dev`
- `RENDER_WORKER_SECRET` = the same value as on Fly

Then redeploy. To roll back, remove `RENDER_WORKER_URL` and redeploy.

### Handy commands

```bash
fly logs                 # live worker logs ("render <job> finished in 12.3s")
fly status               # machines and whether they're started or stopped
```

## Google Cloud Run (alternative)

```bash
PROJECT=your-gcp-project
REGION=us-east1
IMAGE=$REGION-docker.pkg.dev/$PROJECT/fooddie/render-worker

gcloud config set project $PROJECT
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com storage.googleapis.com
gcloud artifacts repositories create fooddie --repository-format=docker --location=$REGION
gcloud storage buckets create gs://$PROJECT-build --location=$REGION    # own staging bucket (once)
gcloud builds submit --config worker/cloudbuild.yaml --substitutions=_IMAGE=$IMAGE \
  --gcs-source-staging-dir=gs://$PROJECT-build/source .
gcloud run deploy fooddie-render --image $IMAGE --region $REGION \
  --cpu 2 --memory 4Gi --concurrency 1 --timeout 600 \
  --min-instances 0 --max-instances 3 --allow-unauthenticated \
  --env-vars-file ~/render.env.yaml      # same keys as above, as YAML (KEY: "value")
```

Then set `RENDER_WORKER_URL` on Vercel to the Service URL it prints.
