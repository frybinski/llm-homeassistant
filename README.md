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
