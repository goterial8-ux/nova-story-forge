# Publish To GitHub

Suggested repository name:

```text
nova-story-forge
```

Visibility:

```text
Public
```

## Option A: GitHub Website

1. Open GitHub.
2. Click **New repository**.
3. Repository name: `nova-story-forge`.
4. Visibility: **Public**.
5. Create an empty repository.
6. Upload the contents of this folder:

```text
C:\Users\andre\OneDrive\Документы\аи асистент\nova-story-forge
```

Do not upload a real `.env` file.

## Option B: After Installing Git

Run these commands inside the project folder:

```bash
git init
git add .
git commit -m "Initial Nova Story Forge"
git branch -M main
git remote add origin https://github.com/goterial8-ux/nova-story-forge.git
git push -u origin main
```

## Cloud Run Variables

Set these in Cloud Run, not in the repository:

```env
GOOGLE_GENAI_USE_VERTEXAI=True
GOOGLE_CLOUD_PROJECT=your-google-cloud-project
GOOGLE_CLOUD_LOCATION=global
SCRIPT_WRITER_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-anthropic-key
ANTHROPIC_MODEL=your-claude-model
```
