# Publish To GitHub

The full prepared project is currently local on this machine:

```text
C:\Users\andre\OneDrive\Документы\аи асистент\nova-story-forge
```

A ready ZIP also exists here:

```text
C:\Users\andre\OneDrive\Документы\аи асистент\nova-story-forge.zip
```

## Upload Through GitHub Website

1. Open the repository page.
2. Click **Add file**.
3. Choose **Upload files**.
4. Drag the contents of the local `nova-story-forge` folder into the upload area.
5. Do not upload a real `.env` file.
6. Commit the upload to `main`.

## Upload With Git After Installing It

Run these commands inside the local project folder:

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
