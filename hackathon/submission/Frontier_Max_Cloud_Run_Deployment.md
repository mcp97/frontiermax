# Frontier Max — Cloud Run deployment

The public ChatGPT Sites build is already live at https://agent-frontier.monilpat.chatgpt.site. For the safest Google AI Studio track submission, also deploy the same source to Cloud Run and submit that URL together with the AI Studio share link.

## 1. Prepare Google Cloud

- Create or select the hackathon Google Cloud project.
- Confirm billing and Gemini quota.
- Create a Gemini API key in Google AI Studio and test it.
- Install and authenticate the Google Cloud CLI on your laptop.

## 2. Store the Gemini key as a secret

Do not commit the key or paste it into the deck, videos, or submission form. Create a Secret Manager secret named `frontier-max-gemini`, add the current key as its latest version, and grant the Cloud Run service account access.

## 3. Deploy from the repository root

```bash
read -r -p "Google Cloud project ID: " PROJECT_ID
test -n "$PROJECT_ID" || { echo "A project ID is required."; exit 1; }
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
gcloud run deploy frontier-max --source . --region us-west1 --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=frontier-max-gemini:latest
```

Cloud Run supplies `PORT`; the existing production start command binds to it. The product keeps a static BenchmarkList bootstrap available when optional storage services are absent.

The Cloud Run deployment does not reproduce the ChatGPT Sites D1 database and R2 object-store bindings. The source-linked catalog falls back to the checked-in static bootstrap, so the Reader, policy UI, Gemini interpreter, CLI downloads, and source provenance remain available. Stored benchmark-detail result tables remain available only on the Sites mirror unless a separate storage and read path is added to Cloud Run.

## 4. Verify before submitting

- Open the Cloud Run URL in a signed-out/incognito window.
- On `/use`, run both prefilled Gemini examples and verify model provenance.
- Confirm `GEMINI_API_KEY` is active server-side and never appears in browser source or network responses.
- Verify the CLI and source download links return `200`.
- Confirm no login is required for the golden path.
- Share the Google AI Studio project used to create and test the Gemini path.
- Submit the Cloud Run URL, repository URL, and AI Studio share link together.

Official reference: https://docs.cloud.google.com/run/docs/quickstarts/frameworks/deploy-nextjs-service
