# Nova Story Forge

Nova Story Forge is a manga/manhwa recap story planning studio.

The app is used to prepare structured story material before script writing:

* Raw Idea
* Style Analyzer
* Story DNA
* Story Plan
* Scene Cards
* Manual Script Writer
* Clean Export

## Current Workflow

This project is now focused on separating planning from final script writing.

Nova Story Forge prepares the story structure:

* premise and genre direction
* character and world logic
* full Story Plan
* Scene Cards for each part
* part titles and scene progression
* continuity material for the script writer

The Script Writer stage is now a manual full-part writer.

One generation request should write one complete part:

```text
Part 1 -> full Part 1 script
Part 2 -> full Part 2 script
Part 3 -> full Part 3 script
```

The writer should receive only the relevant material for the selected part:

* Current Part Plan
* Current Part Scene Cards
* previous written context / continuity
* style rules
* target length

This avoids the old overloaded automation flow.

## Script Writer Philosophy

The Script Writer should behave like a clean writing console, not an autonomous repair system.

It should not rely on:

* Generate All
* automatic repair loops
* automatic rebuild loops
* automatic approval
* hidden supervisor decisions
* fallback rewriting through another model

The user controls the writing process manually:

1. Select a part.
2. Check that Current Part Plan is filled.
3. Check that Current Part Scene Cards are filled.
4. Adjust style rules if needed.
5. Generate the full part.
6. Review the output manually.
7. Save or regenerate the part.

## Writing Style

The target style is YouTube manga/manhwa recap.

Default script language: English.

The main voice can be first person when the scene follows the protagonist directly.

Third person is allowed when showing:

* other characters' actions;
* enemy reactions;
* crowd reactions;
* political consequences;
* large-scale events;
* events outside the protagonist's direct view.

The script should sound like voiceover for a recap video.

The writer should avoid:

* dry summaries;
* novel-like overdescription;
* technical reports;
* analysis tone;
* system messages;
* prompt residue.

## Target Part Length

One request equals one complete part.

Default part length:

```text
12,000–15,000 characters including spaces
```

Paragraphs should be readable for voiceover.

Recommended paragraph range:

```text
120–220 characters including spaces
```

This is a writing target, not a reason to destroy story quality.

## AI Routing

Normal planning stages can use Gemini / Vertex AI.

Script Writer should use a Claude-compatible provider.

Recommended current setup for Claude-compatible Script Writer:

```env
SCRIPT_WRITER_PROVIDER=claude_compatible
CLAUDE_WRITER_PROVIDER=claude_compatible

CLAUDE_COMPAT_API_KEY=secret-manager-value-only
CLAUDE_COMPAT_BASE_URL=https://aiprimetech.io/v1
CLAUDE_COMPAT_MESSAGES_ENDPOINT=https://aiprimetech.io/v1/messages

CLAUDE_WRITER_MODEL=claude-sonnet-4-6
CLAUDE_WRITER_MAX_TOKENS=8000
```

Do not commit real API keys.

In Cloud Run, store real keys in Secret Manager or environment variables.

## Environment Variables

For Cloud Run / Vertex AI:

```env
GOOGLE_GENAI_USE_VERTEXAI=True
GOOGLE_CLOUD_PROJECT=your-google-cloud-project
GOOGLE_CLOUD_LOCATION=global
PORT=8080
```

For Claude-compatible Script Writer:

```env
SCRIPT_WRITER_PROVIDER=claude_compatible
CLAUDE_WRITER_PROVIDER=claude_compatible
CLAUDE_COMPAT_API_KEY=secret-manager-value-only
CLAUDE_COMPAT_BASE_URL=https://aiprimetech.io/v1
CLAUDE_COMPAT_MESSAGES_ENDPOINT=https://aiprimetech.io/v1/messages
CLAUDE_WRITER_MODEL=claude-sonnet-4-6
CLAUDE_WRITER_MAX_TOKENS=8000
```

Legacy TKBK variables may exist in older deployments, but the preferred setup is the generic Claude-compatible configuration.

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

They should be used only as rhythm and style references.

Do not copy competitor plots, names, scenes, or unique twists.
