# Brand system: rules for every phase

These hold in every brand-system phase. A phase prompt can narrow them; it never loosens them without saying CJ approved it.

## The system

1. **One render path.** Every graphic draws through `SchemaRenderer` and exports through `renderSchemaBlob` / `exportSchemaPng`. No second renderer, and no server-side renderer unless a decision adds one.
2. **Frozen types need sign-off.** `TemplateSchema`, `TemplateField`, `LayoutGroup`, `BrandKit` and every table column change only after CJ approves the exact shape at the phase's recon gate.
3. **Absent means today.** Every new property is optional, and a template or kit without it renders exactly as it did before. The fidelity fixtures prove it.
4. **Wired end to end.** A new field property follows the `field-property` skill; a brand kit change follows the `brand-kit-change` skill. A half-wired property is a bug.
5. **Migrations are additive.** Use the next number reserved in `PLAN.md`. Never edit a committed migration (a hook blocks it).
6. **Baked values, one live channel.** Fields copy hex at pick time and carry no live palette binding (migration 0023). Colourways and generated designs write baked values into ordinary fields and `TemplateVariant` overrides. Type styles stay the one live brand channel unless decision D3 says otherwise.
7. **The fidelity harness is the ruler.** A phase that touches rendering, export, import or template types adds or updates fixtures and passes `node scripts/fidelity/fidelity.mjs run` on Chromium, Firefox and WebKit. A recorded baseline never gets worse, and only CJ approves a new baseline or golden.
8. **Deterministic first.** Anything measurable (contrast, safe zones, clear space, fit, rhythm) is computed and checked in code. Models choose and write; compilers place and checks gate.
9. **Never trust model output.** Every model call is a forced tool call whose result is validated before use, the way `validateExtraction` treats the website pull. A phase that adds a model call reports its calls and tokens per draft.
10. **Tenant neutrality.** Tenant code paths carry no SocialPaint brand values. Fixtures use the sample workspace, fixture tenants, or SocialPaint as tenant one.
11. **Mirrors stay identical.** Logic mirrored into `supabase/functions/_shared/` stays byte-identical to its `src` twin, and `npm run typecheck:deno` passes.

## The product

12. **Platform UI follows `docs/design/new-look/RULES.md`.** Tokens, corners, elevation, type and interaction states come from there.
13. **Copy.** Sentence case, second person, no exclamation points, no em dashes, and no helper lines that explain how the UI works. When the app asks the user something, it asks it as a question ("What is the role you are hiring for?").
14. **Code hygiene.** No hex literals in TSX, no off-scale spacing, no emoji in code, comments or copy.

## The work

15. **Scope.** Each prompt lists what not to touch. Anything outside the scope gets reported in the gate report, not changed.
16. **Steps and gates.** Commit after each step with `npm run verify` green. Stop at every gate the prompt names and wait for CJ.
17. **Review before the PR.** Run the `phase-reviewer` subagent, plus `fidelity-checker` when rule 7 applies, and fix every must-fix finding first.
18. **Keep the plan current.** Update the phase's status and any reserved migration numbers in `PLAN.md` as part of the phase.
