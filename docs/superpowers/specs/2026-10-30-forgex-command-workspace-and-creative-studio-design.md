# FORGEX AI Command Workspace and Creative Studio Design

**Status:** Owner requested execution; implementation proceeds on the existing feature branch.
**Date:** 2026-10-30

## Intent

Evolve FORGEX AI from a conventional dark developer dashboard into a premium, unified AI engineering and creative workspace. The visual direction combines the calm precision, spacious typography, and product polish associated with Apple/Tesla interfaces with the central prompt-and-workspace interaction model of Google AI Studio. The product must remain a real engineering tool: controls must perform real actions or clearly disclose that an integration is not yet available.

## Owner-specific development access

- The repository owner needs unrestricted access to FORGEX-owned features while building, testing, and evaluating the product.
- Development access must not silently consume owner subscription credits or impose product-created paywalls.
- This does not make third-party API usage, cloud rendering, GPU time, model inference, or external provider charges free. Those costs must be disclosed and remain attributable to the provider/account that incurs them.
- Customer-facing plans and entitlements are a separate future product policy and must not constrain the owner development workspace.

## Goals

- Create a premium application shell with a persistent left navigation rail, top utility bar, large central work surface, and contextual right-side inspector where useful.
- Preserve a fast, central prompt-first workspace similar in interaction model to AI Studio.
- Add first-class destinations for Engineering, Project Lab, Creative Studio, Mockups, Advertising, Motion & Video, Brand Studio, 3D Assets, Integrations, and Release Center.
- Support Arabic RTL as the primary language and English LTR without mirroring icons incorrectly.
- Provide dark and light themes, responsive layouts, keyboard-accessible controls, restrained motion, clear focus states, and reduced-motion support.
- Make the design system consistent: typography scale, spacing, surfaces, borders, radii, and semantic status colors.
- Make all navigation and workspace controls real. If an underlying capability is not implemented or connected, show a truthful disabled/blocked/not-configured state and a clear next step.
- Remove success fallbacks that report completion when a request failed.

## Non-goals for the first UI phase

- Do not claim image/video generation is implemented merely because a Creative Studio screen exists.
- Do not simulate live provider, build, emulator, repository, or rendering status.
- Do not embed third-party paid generation as if it were free.
- Do not rewrite the engineering backend or remove its existing auth, RBAC, sandbox, approval, rollback, or audit behavior as part of a visual-shell change.

## Approaches considered

1. **Premium command workspace — selected.** A Tesla/Apple-inspired product shell around an AI Studio-style central canvas. This best combines the user's visual direction with the existing prompt-first and engineering workspace flows.
2. **Pure dashboard-first.** A large metrics dashboard as the default page. Rejected because it pushes the actual work surface behind navigation and risks decorative/fake metrics.
3. **Pure chat-first.** A single chat surface with tools hidden behind menus. Rejected because it obscures the breadth of engineering and creative capabilities.

## Existing codebase findings

- Frontend is React 19 + TypeScript + Vite + Tailwind CSS 4, with motion and lucide-react already installed.
- src/App.tsx owns the main view state and routes among studio, home, and workspace.
- src/components/Header.tsx currently renders a compact horizontal tab bar and service badges.
- src/components/CommandCenterView.tsx is a centered prompt form with recent task cards.
- src/index.css has only a minimal dark GitHub-like base style.
- src/App.tsx currently has a catch block in handleSendStudio that appends a success message when the API call fails. This is a correctness bug and must be corrected before redesigning status presentation.

## Design direction

- Premium, spacious, calm interface; avoid dense grids and generic admin-dashboard cards.
- Deep graphite and warm neutral surfaces in dark mode; clean white/soft gray surfaces in light mode; one restrained accent color.
- Strong typographic hierarchy, oversized page titles, concise supporting copy, and generous whitespace.
- A narrow left navigation rail that expands to labels; main work area remains visually dominant.
- A contextual inspector may appear on the right for model, project, device preview, asset properties, or run evidence.
- Motion is purposeful: short transitions, subtle depth, meaningful loading states, no continuous decorative animation.
- Creative screens use large visual previews and clear tool stages (brief, assets, composition, preview, export), but only expose actions backed by real functionality.

## Navigation information architecture

1. Overview / Home
2. AI Workspace
3. Engineering
4. Project Lab & Testing
5. Creative Studio: Mockups, Advertising, Motion & Video, Brand Identity, 3D Assets
6. Projects & Repository
7. Integrations / Models
8. Release Center
9. Settings

## Owner development entitlement

Use an explicit owner/development entitlement in the application policy, separate from customer billing. It grants access to FORGEX product features for the repository owner during development. It must not override provider-side authentication, quotas, rate limits, GPU availability, external licensing, or cloud service billing. Never store provider credentials in browser storage.

## Accessibility and responsiveness

- Arabic defaults to RTL; English defaults to LTR.
- Use semantic buttons/links and visible focus rings.
- Honor prefers-reduced-motion.
- On narrow screens, collapse navigation into a drawer and move inspectors into a sheet; keep the main prompt and current work visible.
- Do not use color alone to communicate status.

## Acceptance criteria

1. The main shell has clear navigation, central workspace, and consistent responsive behavior.
2. The existing engineering workspace remains reachable and its existing actions are preserved.
3. The new creative destinations are navigable and accurately label unavailable integrations/capabilities.
4. Arabic and English layouts render in the correct direction.
5. Light and dark themes are usable and consistent.
6. API failures never become success messages.
7. No decorative fake metrics, fabricated provider connections, or false generation/build completion states are introduced.
8. Typecheck, tests, smoke tests, and production build pass before the UI phase is called verified.