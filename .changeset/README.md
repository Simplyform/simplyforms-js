# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).

When you make a change worth releasing, run `pnpm changeset`, describe it, and commit the
generated file. `simplyforms` and `@simplyforms/sdk` are versioned **in lockstep** (the `fixed`
group in `config.json`), so one changeset bumps both to the same version.

Per project convention: **minor** bumps for features, **patch** for fixes/polish.
