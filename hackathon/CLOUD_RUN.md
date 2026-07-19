# Frontier Max — Google track deployment

This repository can be deployed as a public HTTP service on Google Cloud Run.
The UI and deterministic policy engine run in Vinext; Gemini 3.5 Flash powers
the task-to-policy interpretation endpoint.

## Before the sprint

1. Create or select the hackathon Google Cloud project and confirm billing.
2. Create a Gemini API key in Google AI Studio and test one request.
3. Enable Cloud Run and Cloud Build.
4. Store the key as a Cloud Run secret named `frontier-max-gemini` and expose it
   to the service as `GEMINI_API_KEY`.

## Deploy from source

From the repository root:

```bash
read -r -p "Google Cloud project ID: " PROJECT_ID
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
gcloud run deploy frontier-max --source . --region us-west1 --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=frontier-max-gemini:latest

SERVICE_URL="$(gcloud run services describe frontier-max --region us-west1 --format='value(status.url)')"
gcloud run services update frontier-max --region us-west1 \
  --set-env-vars NEXT_PUBLIC_SITE_URL="$SERVICE_URL"
```

Cloud Run supplies `PORT`; `npm start` binds to it automatically. The static
BenchmarkList bootstrap keeps the catalog legible when D1/R2 are unavailable.
The Reader, policy UI, Gemini interpreter, CLI downloads, and source provenance
remain available. Cloud Run does not reproduce the ChatGPT Sites D1/R2 stores:
the full catalog falls back to the checked-in static Bootstrap, while stored
benchmark-detail result tables remain available only on the Sites mirror unless
you add a separate storage/read path.

## Submission checks

- Open the Cloud Run URL in an incognito window.
- Run both Gemini examples on `/use` and confirm the returned model provenance.
- Confirm the CLI and source download links return `200`.
- Share the Google AI Studio project used to create/test the Gemini key path.
- Submit the Cloud Run URL, repository URL, and AI Studio share link together.
- Never commit or paste the Gemini key into the repository, slides, videos, or
  submission form.
