/**
 * PROJECT CONTRACT v2.0
 *
 * Это неизменный документ, описывающий инварианты проекта.
 * Передаётся в LLM для ВСЕХ генераций (template_filling и fragment_editing).
 *
 * CONTRACT = LAW
 * LLM ДОЛЖЕН следовать этому контракту ВСЕГДА.
 */

export const PROJECT_CONTRACT = `PROJECT CONTRACT v2.0
════════════════════════════════════════════════════════════════════

🏗️ ARCHITECTURE:
- Framework: Next.js 15.1.4
- UI Library: React 19
- Styling: Tailwind CSS 3.4.1
- Component Structure: /components, /hooks, /utils, /pages
- Entry point: /App.js
- Default files: /index.js, /App.css
- Template-based generation with slot markers

📦 DEPENDENCIES LOCKED:
The following packages are FIXED and CANNOT be changed:
- react: 19.x
- next: 15.1.4
- tailwindcss: 3.4.1
- lucide-react: latest
- uuid: 11.1.0
- postcss: ^8
- autoprefixer: ^10.0.0
- (other packages as per package.json)

🔒 IMMUTABLE INVARIANTS:

1. TEMPLATE STRUCTURE:
   - All components MAY use data-slot="..." markers for content slots
   - data-slot markers MUST be preserved during editing
   - Slots are immutable - never remove them
   - Only slot TEXT CONTENT can be modified in template_filling mode
   - Layout and structure are FIXED

2. STYLING RULES:
   - ONLY use Tailwind CSS utility classes
   - NO inline styles (<style> tags or style props)
   - NO custom CSS files (except /App.css)
   - Color palette: only from Tailwind defaults
   - Responsive: mobile-first approach
   - DO NOT override Tailwind config

3. IMPORTS & DEPENDENCIES:
   - NEVER add packages outside DEPENDENCIES LOCKED list
   - ALWAYS use absolute imports (@/)
   - Local imports: relative paths for components
   - NO 'use server' or server components
   - NO backend logic or database calls

4. COMPONENT STANDARDS:
   - Functional components ONLY (no classes)
   - React hooks for state (useState, useEffect, useContext)
   - Component names: PascalCase
   - Hook names: camelCase with 'use' prefix
   - Utils functions: camelCase
   - Constants: UPPER_SNAKE_CASE

5. FILE STRUCTURE:
   - NEVER change default files (/App.js, /index.js)
   - NEVER delete components without permission
   - Component = 1 file (no multi-component files)
   - Organize in: /components, /hooks, /utils

6. RESPONSE FORMAT:
   - Return ONLY the complete updated file(s) in JSON
   - Include ALL files (modified + unchanged) to ensure consistency
   - In fragment_editing: only target file is modified
   - In template_filling: only slot contents are modified

⚠️  FORBIDDEN ACTIONS (WILL BREAK PROJECT):
   ✗ Add backend logic or database calls
   ✗ Change package.json dependencies
   ✗ Modify entry point files (/App.js, /index.js) without permission
   ✗ Break existing component APIs
   ✗ Add inline styles or custom CSS
   ✗ Remove default components
   ✗ Add new packages/imports
   ✗ Use server-side features
   ✗ Remove data-slot markers
   ✗ Change slot structure or nesting

════════════════════════════════════════════════════════════════════
CRITICAL: This contract is the SOURCE OF TRUTH for code generation.
Any deviation will break the project integrity.
════════════════════════════════════════════════════════════════════`;

/**
 * Response format для template_filling режима
 */
export const TEMPLATE_FILLING_RESPONSE_FORMAT = `
{
  "mode": "template_filling",
  "explanation": "Filled slots with appropriate content",
  "files": {
    "/path/to/template.jsx": { "code": "[COMPLETE UPDATED TEMPLATE WITH FILLED SLOTS]" }
  }
}`;

/**
 * Response format для fragment_editing режима
 */
export const FRAGMENT_EDITING_RESPONSE_FORMAT = `
{
  "mode": "fragment_editing",
  "explanation": "Modified component according to request",
  "files": {
    "/path/to/component.jsx": { "code": "[COMPLETE UPDATED COMPONENT]" },
    "/other/file.jsx": { "code": "[UNCHANGED]" },
    ...
  }
}`;

export default {
  PROJECT_CONTRACT,
  TEMPLATE_FILLING_RESPONSE_FORMAT,
  FRAGMENT_EDITING_RESPONSE_FORMAT
};
