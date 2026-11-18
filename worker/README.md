# Render worker (Cloud Run)

The final video render (ffmpeg) is the heaviest CPU work in the app. On Vercel it counts against Fluid
Active CPU (4 h/month on Hobby). This worker runs the exact same render code (`src/lib/render-job.ts`)
on Google Cloud Run, whose free tier covers far more CPU.

How it fits: `POST /api/scans/[id]/render` on Vercel creates the `jobs` row as before, then (when
`RENDER_WORKER_URL` is set) calls the worker and just waits on the network. The worker writes progress,
cancel and the result to the same `jobs` row, so the browser and `/api/jobs/[id]` don't change.
Unset `RENDER_WORKER_URL` on Vercel to render on Vercel again.

## One-time setup

```bash
PROJECT=your-gcp-project
REGION=us-east1                      # close to Vercel's iad1
IMAGE=$REGION-docker.pkg.dev/$PROJECT/fooddie/render-worker
SECRET=$(openssl rand -hex 32)       # keep this; Vercel needs the same value

gcloud config set project $PROJECT
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create fooddie --repository-format=docker --location=$REGION
```

## Build and deploy (run from the repo root; repeat after render code changes)

```bash
gcloud builds submit --config worker/cloudbuild.yaml --substitutions=_IMAGE=$IMAGE .

gcloud run deploy fooddie-render --image $IMAGE --region $REGION \
  --cpu 2 --memory 4Gi --concurrency 1 --timeout 600 \
  --min-instances 0 --max-instances 3 --allow-unauthenticated \
  --set-env-vars "RENDER_WORKER_SECRET=$SECRET,NEXT_PUBLIC_SUPABASE_URL=...,SUPABASE_SERVICE_ROLE_KEY=...,R2_ACCOUNT_ID=...,R2_ACCESS_KEY_ID=...,R2_SECRET_ACCESS_KEY=...,R2_IMAGES_BUCKET=...,R2_VIDEOS_BUCKET=..."
```

- `--concurrency 1`: one render per instance, so renders never share CPU.
- `--memory 4Gi`: Cloud Run's `/tmp` is in memory, and a render downloads up to 6 uploaded videos.
- `--allow-unauthenticated`: the URL is public, but every render needs the `RENDER_WORKER_SECRET` bearer token.
- Default request-based billing: you pay only while a render runs, and nothing when idle.

Check it: `curl https://<service-url>/healthz` → `{"ok":true}`.

## Switch Vercel over

In the fooddiescanner project's environment variables (Production), add:

- `RENDER_WORKER_URL` = the Cloud Run service URL
- `RENDER_WORKER_SECRET` = the same `$SECRET`

Then redeploy. To roll back, remove `RENDER_WORKER_URL` and redeploy.
