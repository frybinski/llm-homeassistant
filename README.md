# AI Drafts

A Home Assistant custom integration for designing automations (and later
dashboards) in natural language. The model never writes configuration directly:
it produces a *change set*, deterministic checks validate it, and you approve it
before anything is written.

**Status: pre-alpha (milestone M0).** The integration installs, offers a choice
of model source, and adds an almost empty "AI Drafts" panel to the sidebar. The
change set data model and its state machine exist, but nothing calls a model yet.
See [PLAN.md](PLAN.md) for the plan (in German).

Requires Home Assistant 2026.10.0 or newer.

## Data sent to the model

When model calls arrive, each request will send your request text plus the
names, IDs and states of entities, devices, areas and existing automations to
the model source you choose. The config flow states this before you decide.

## Model servers

With the source "OpenAI-compatible server" the base URL must point at the
server's OpenAI-compatible API. The config flow tests it by asking the server
for its models, and offers them in the next step. The source can be changed
later under Settings, Devices & services, AI Drafts, Reconfigure.

| Server | Base URL | API key |
| --- | --- | --- |
| Ollama | `http://<host>:11434/v1` | none |
| Open WebUI | `https://<host>/api` | required, from the account settings |
| LM Studio | `http://<host>:1234/v1` | none |
| OpenAI | `https://api.openai.com/v1` | required |

For Open WebUI, `/ollama` is a passthrough to Ollama's own API and does not
work here.

## Development

Requirements: Python 3.14, [uv](https://docs.astral.sh/uv/) (or `python3.14 -m venv`),
Node 22. A devcontainer is provided.

```bash
scripts/setup     # create .venv, install requirements_dev.txt, build the frontend
scripts/develop   # start Home Assistant on http://localhost:8123 using config/
scripts/lint      # ruff and the frontend type check
```

The dev instance (`config/configuration.yaml`) loads a small set of components,
the demo integration, and template entities for the hallway scenario of
milestone M1 (`binary_sensor.flur_bewegungsmelder`, `light.flurlicht`). Complete
onboarding, then add the AI Drafts integration under Settings, Devices &
services.

### Developing without a model

`scripts/fake_model.py` is a tiny OpenAI-compatible server (port 11435) that
answers with canned change sets, so the whole pipeline can be tried in the dev
instance without a language model. Start it with
`.venv/bin/python scripts/fake_model.py`, then add AI Drafts with the
"OpenAI-compatible server" source, base URL `http://127.0.0.1:11435/v1`, any
model name and no API key. Words in the request choose the answer: "Flurlicht"
gives a valid automation, "Gartenlicht" first an invalid one and a valid one
after one repair round, "Bad" an invalid one every time (the change set ends
`failed`), "kaputt" text that is not JSON once and then a valid answer. The
docstring of the script has the details. It says nothing about how a real model
behaves.

### Tests

```bash
.venv/bin/python -m pytest
```

### Frontend

The panel is Lit and TypeScript in `frontend/`. The built bundle
`custom_components/ai_drafts/frontend/ai-drafts-panel.js` is checked in; CI fails
if it is out of date.

```bash
cd frontend
npm ci
npm run build
```

## License

[MIT](LICENSE)
