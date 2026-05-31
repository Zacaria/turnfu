# Agent Instructions

## Package Manager

- Use pnpm for all Node.js dependency work in this repository.
- Run installs with `pnpm install`.
- Run scripts with `pnpm <script>` or `pnpm run <script>`.
- Keep `pnpm-lock.yaml` as the only JavaScript lockfile. Do not create or commit `package-lock.json` or `yarn.lock`.

## Worktrees

- Do not share, symlink, or reuse a single `node_modules` directory across worktrees.
- Each worktree should have its own `node_modules` directory.
- pnpm already shares package contents through its global content-addressable store, which is the intended dependency mutualization layer.
- Do not commit pnpm store directories such as `.pnpm-store/`.

## Shell

- Prefix shell commands with `rtk` when running commands manually in Codex.
