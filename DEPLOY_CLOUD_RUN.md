# Deploy To Cloud Run

Repository:

```text
https://github.com/goterial8-ux/nova-story-forge
```

The project includes a `Dockerfile`, so Cloud Run / Cloud Build can build the container directly from the repository.

## Required Cloud Run Environment Variables

Set these in Cloud Run service settings:

```env
GOOGLE_GENAI_USE_VERTEXAI=True
GOOGLE_CLOUD_PROJECT=your-google-cloud-project
GOOGLE_CLOUD_LOCATION=global
PORT=8080
SCRIPT_WRITER_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-anthropic-key
ANTHROPIC_MODEL=your-claude-model
```

`SCRIPT_WRITER_PROVIDER=anthropic` makes Claude handle Script Writer only.
AI Supervisor and other stages remain on Vertex AI / Gemini.

## Required Permissions

The Cloud Run service account needs permission to call Vertex AI.

Recommended role:

```text
Vertex AI User
```

In IAM, grant this role to the service account used by the Cloud Run service.

## Console Deployment Steps

1. Open Google Cloud Console.
2. Go to Cloud Run.
3. Click Create service.
4. Choose Continuously deploy from a repository, or deploy from source if using Cloud Shell.
5. Connect GitHub repository:

```text
goterial8-ux/nova-story-forge
```

6. Use branch:

```text
main
```

7. Keep the Dockerfile build option.
8. Service name suggestion:

```text
nova-story-forge
```

9. Region suggestion:

```text
europe-west1
```

10. Authentication:

For private personal use, choose unauthenticated access only if you are comfortable with the app being public.

11. Add the environment variables above.
12. Deploy.

## If Deploy Fails

Check Cloud Run logs for:

- missing `GOOGLE_CLOUD_PROJECT`
- missing `ANTHROPIC_API_KEY`
- Cloud Run service account missing Vertex AI permissions
- build errors from `npm run build`
- Anthropic model name typo

## Important

Never commit a real `.env` file or real API keys into GitHub.
