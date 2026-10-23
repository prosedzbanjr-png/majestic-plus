# Chatlog Magician PL

Polish-language GTA RP chatlog editor built in the existing Next.js/Vercel project.

## Current editor features

- Paste or load plain-text chat logs.
- Live preview with character highlighting, basic game/system line colors, emote and italic formatting.
- Search, category filters, speaker filters, and a privacy mask for names and phone-like numbers.
- Typography controls, contrast, background treatment, and PNG export.
- Local presets and local history stored in the current browser.
- Responsive layout for desktop and mobile.

## Development

\`\`\`bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
\`\`\`

The project still uses Next.js 16.3.3, React 19.1.0, TypeScript, ESLint, and Vitest. Existing backend/API modules have not been removed as part of the homepage replacement. The untouched pre-change code is preserved in the Git branch \`backup/majestic-plus-original-2026-10-23\`.

## Scope note

This is a Polish implementation of the main Chatlog Magician workflow, not a byte-for-byte copy of the third-party source. Features that require the original app's full parser, canvas/layer engine, cloud sync, or community preset service are not yet implemented in this first pass.
