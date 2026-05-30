# Codebase cleanup TODOs

- Replace the remaining `Record<string, any>` component props with explicit props interfaces, starting with `ConfigTabs` and `ConfigSections`.
- Tighten the remaining loosely typed component props and callbacks so ESLint can disallow explicit `any` across the frontend.
- Break up dense JSX in legacy form sections such as `FrameSection` into smaller typed field-row components.
- Normalize naming and spelling in plotting modules, including the existing `plot_acessories.py` filename.
- Audit frontend strings and move remaining hard-coded labels into `src/uiTranslations.ts`.
- Add focused tests for dataframe/frame duplication, reordering, and create-all selection behavior.
- Review generated build artifacts in `dist/` and decide whether the project should consistently track or ignore them.
