# Nova Story Forge

Public-ready manga/manhwa recap story studio based on the Strategy Nova workflow.

The app turns a raw idea into a staged story pipeline:

- Raw Idea
- Style Analyzer
- Story DNA
- Story Plan
- Scene Cards
- Script Writer
- Clean Export

## What This Fork Fixes

This version separates draft writing from final formatting.

Script Writer is responsible for story quality:

- first-person manga/manhwa recap voice
- strong protagonist agency
- survival/progression logic
- visual payoffs
- face-slap moments
- continuity
- niche fit

Clean Export / Final Polish is responsible for strict formatting:

- final paragraph length
- voiceover cleanup
- removal of headings and labels
- final export polish

This prevents good script drafts from being blocked only because draft paragraphs are shorter than the final voiceover target.

## AI Routing

The server supports three provider modes:

- Vertex AI / Gemini for normal stages and AI Supervisor
- TKBK Claude-compatible API for Script Writer when `TKBK_API_KEY` is available
- Anthropic Claude for Script Writer as a backward-compatible fallback

Script Writer can be routed from the UI, or through env. Recommended TKBK setup:

```env
SCRIPT_WRITER_PROVIDER=tkbk
CLAUDE_WRITER_PROVIDER=tkbk
CLAUDE_WRITER_MODEL=claude-sonnet-4-6
```

If no provider is supplied, the server auto-selects TKBK when `TKBK_API_KEY` exists, then Anthropic when `ANTHROPIC_API_KEY` exists, otherwise Gemini.

AI Supervisor remains on Gemini / Vertex AI.

## Environment Variables

For Cloud Run / Vertex AI:

```env
GOOGLE_GENAI_USE_VERTEXAI=True
GOOGLE_CLOUD_PROJECT=your-google-cloud-project
GOOGLE_CLOUD_LOCATION=global
PORT=8080
```

For TKBK Claude-compatible Script Writer:

```env
SCRIPT_WRITER_PROVIDER=tkbk
CLAUDE_WRITER_PROVIDER=tkbk
CLAUDE_WRITER_MODEL=claude-sonnet-4-6
CLAUDE_WRITER_MAX_TOKENS=8000
TKBK_CLAUDE_ENDPOINT=https://api.tkbk.io/claude/v1/messages
TKBK_API_KEY=secret-manager-value-only
```

For direct Anthropic Claude Script Writer:

```env
SCRIPT_WRITER_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-anthropic-key
ANTHROPIC_MODEL=your-claude-model
```

Do not commit real API keys. In Cloud Run, store `TKBK_API_KEY` in Secret Manager and mount it as an environment variable.

## Local Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## Notes

Built-in reference scripts are stored in:

```text
public/reference-scripts/
```

They should be used as rhythm and style references, not as plot material to copy.
