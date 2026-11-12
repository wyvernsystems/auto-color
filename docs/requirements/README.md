# Requirements

Working requirements for **Auto Color**, one file per feature. Each
requirement has a stable ID; tests name the IDs they cover, so
`grep -rn "PAL-" src/` finds the tests for a feature. Never reuse or
renumber an ID; retire one by deleting it and leaving the gap.

| Feature | IDs | File |
| --- | --- | --- |
| Palette engine | `PAL-` | [palette.md](./palette.md) |
| Workspace identity | `IDENT-` | [identity.md](./identity.md) |
| Themes, colors, and favorites | `THEME-` | [themes-and-colors.md](./themes-and-colors.md) |
| Workspace settings writes | `WRITE-` | [workspace-writes.md](./workspace-writes.md) |
| Commands and settings | `CMD-` | [commands.md](./commands.md) |
| Branch and environment colors | `ALERT-` | [branch-and-environment.md](./branch-and-environment.md) |
| CLI (`auto-color-cli`) | `CLI-` | [cli.md](./cli.md) |
| Project constraints | `PROJ-` | [project.md](./project.md) |
