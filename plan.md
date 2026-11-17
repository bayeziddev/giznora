# Giznora Landing Page Builder — Implementation Plan

## Scope and approach
Add an admin-managed landing page builder to the existing React/Vite storefront and Hono/Cloudflare Worker API. Reuse the existing staff bearer authentication, D1 database, R2 media upload endpoint, API client, brand tokens, and order/cart URLs. Store page content as validated, bounded JSON in a dedicated D1 table so pages can be created without a fixed page count or per-page code. Public rendering exposes published pages only.

Each landing page has an editable title, unique URL slug, campaign copy, optional offer end time, hero image, product details, image/text sections, CTA label/link, and publish state. The public `/lp/:slug` route is an ad-focused, fast, mobile-first standalone experience, using responsive imagery, lazy-loaded below-the-fold images, clear product/offer hierarchy, and a persistent order CTA. Offer countdown is derived from an absolute timestamp and expires naturally; it does not claim a false reset. Order CTA defaults to the storefront checkout and can be changed to a product, cart, checkout, or supplied destination.

The admin interface provides unlimited page records through list, create, edit, preview-link, publication toggle, and delete actions. Images use the existing authenticated upload endpoint with URL fallback; the landing-page view supplies alt text and responsive image behavior. Database changes are additive through a new migration. UI follows Giznora's navy/white/orange identity while adapting the provided reference's mobile-first offer funnel and repeated order actions.

## Structure
- `worker/migrations/0026_landing_pages.sql`: additive D1 landing-pages table and indexes.
- `worker/src/routes/landingPages.ts`: public published-page lookup endpoint.
- `worker/src/routes/adminLandingPages.ts`: authenticated admin CRUD and audit records.
- `worker/src/index.ts`: mount public route and protected admin subrouter.
- `web/src/pages/admin/LandingPages.tsx`: campaign page manager/editor and image upload UI.
- `web/src/pages/LandingPage.tsx`: standalone mobile-first published page renderer and live offer timer.
- `web/src/App.tsx`, `web/src/pages/admin/AdminLayout.tsx`, `web/src/styles.css`: routes, navigation, and branded responsive styles.

## Design direction
**Movement:** Giznora's confident navy-and-orange commerce identity, translated into the compact, mobile-first direct-response structure of the supplied campaign reference.

**Core principles:** product imagery loads quickly and leads the page; the offer, benefits and order action are unmistakable; campaign sections remain scannable on narrow screens; published content is safe and easy to revise from the dashboard.

**Color philosophy:** white and soft warm neutrals preserve clarity; deep navy anchors trust and product details; Giznora orange/gold accents highlight limited offers and action without copying the reference's pink palette.

**Layout paradigm:** narrow campaign canvas with an edge-to-edge hero image, stacked persuasion sections and a sticky mobile action bar; dashboard editing stays in the existing admin shell.

**Signature elements:** high-contrast offer chip; compact trust/benefit list; fixed mobile order action.

**Interaction philosophy:** direct, predictable edits, immediate preview access, visible save/publish state, accessible form labels and keyboard-operable actions.

**Animation:** brief opacity/position transitions only; no heavy motion, carousel or blocking effects. Countdown updates once per second and disappears after expiry.

**Typography system:** reuse the existing system font stack and Bengali-capable fallbacks; campaign title is bold and compact, body copy has generous line height, and CTAs use high-contrast medium-bold text.

**Brand essence:** the Giznora storefront makes technology and useful products easy to discover and order; clear, confident, practical.

**Brand voice:** useful and specific, never exaggerated. Examples: “আজকের অফারটি দেখে অর্ডার করুন।” “পছন্দের পণ্যটি দ্রুত হাতে পেতে এখনই অর্ডার দিন।”

**Wordmark & logo:** reuse the actual Giznora logo component in the admin and existing brand mark on public storefront surfaces; avoid a substitute wordmark.

**Signature brand color:** Giznora orange (`--brand`), used selectively for action and offer cues.
