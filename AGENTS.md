<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# UI Rules

- **All buttons and clickable elements must have `cursor-pointer`** in their Tailwind className. Buttons do not get pointer cursor by default — always add it explicitly. Disabled buttons should also get `cursor-not-allowed`.
<!-- END:nextjs-agent-rules -->
