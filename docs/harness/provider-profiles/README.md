# Provider Profiles

This directory is for optional repo-local provider launch presets.

Use it when this project wants stable defaults for:

- model choice
- print vs interactive runs
- provider-specific launch flags

## Location

Create files under:

- `docs/harness/provider-profiles/codex/`
- `docs/harness/provider-profiles/claude/`

## Example

`docs/harness/provider-profiles/codex/default.env`

```bash
MODEL=o3
PRINT_MODE=0
EXTRA_ARGS="--search"
```

## Notes

- These are optional.
- Repo-local profiles override shared defaults from `/data/projects/harness`.
- Keep them free of secrets.
