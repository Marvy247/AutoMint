# Contributing to AutoMint (testnet-implementation)

This branch is being rebuilt piece by piece through GitHub Issues. Each issue is scoped to one file or one function/component so multiple people can work in parallel without colliding.

## Workflow

1. Find an unassigned issue labeled for the area you want to work in (`contract`, `frontend`, `hook`, `component`, `test`, `docs`, `setup`).
2. Comment `"I'll take this"` on the issue — wait for it to be assigned to you before starting.
3. Fork the repo (or branch directly if you have write access) from `testnet-implementation`:
   ```bash
   git checkout testnet-implementation
   git pull
   git checkout -b <issue-number>-<short-description>
   ```
4. Implement **only** what the issue describes. Leave the `// TODO` markers in any file your issue doesn't cover.
5. Run the relevant test suite locally:
   ```bash
   cargo test --workspace          # contract issues
   cd frontend && npm test          # frontend issues
   npx tsc --noEmit                 # frontend issues
   ```
6. Open a PR **targeting `testnet-implementation`**, not `main`. Title it after the issue, and include `Closes #<issue-number>` in the description.

## Code style

- **Rust**: follow standard `rustfmt` formatting (`cargo fmt`). Contract functions should return `Result<T, Error>` for any fallible operation — no panics on user input.
- **TypeScript**: match the existing patterns in sibling files (hooks use React Query, components use the MemeFi CSS variable theme in `globals.css`). No `any` types.
- Keep PRs scoped to the issue. If you spot an unrelated bug, open a new issue instead of fixing it inline.

## Questions

If an issue's scope is unclear, ask in the issue thread before starting — it's much cheaper to clarify than to redo work.
