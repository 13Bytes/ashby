# Ashby Plot Builder

Browser-based editor for the Ashby `config.json` workflow with a live plot preview.

## Current status

The current branch includes:

- Config editor with dataframe/frame/axis/layer sections.
- Separate **UI language toggle** (header button, not persisted in config).
- **Dataframe language** field (persisted to config and used for plot text).
- Grouped source + language management (Teable/file source mode + plot language list).
- Guideline form inputs for all guideline properties from `reference/docs/config_explanation.jsonc`.
- Material color management with color picker + raw hex/name input.
- Placeholder multi-select inputs for axis columns and whitelist keywords.
- Reset confirmation modal to avoid accidental reset.
- JSON import/export + JSON popup editor.

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run build
npm run lint
```

## Reference

- Config explanation: `reference/docs/config_explanation.jsonc`
- Legacy reference implementation: `reference/`
