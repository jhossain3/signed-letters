

# Custom Handwriting Font Feature

## Overview
Users will be able to draw each letter of the alphabet on small sketchpads to create a personal handwriting font. When writing a letter in "Typed" mode, they can select "My Handwriting" as a font option, which renders their typed text using their hand-drawn character glyphs.

## How It Works

1. **Create Your Font page** -- A dedicated `/create-font` page with a grid of character cells (A-Z, a-z, 0-9, and common punctuation). Each cell is a small drawing canvas where users sketch one character.

2. **Font storage** -- Character stroke data is saved to a new `custom_font_glyphs` database table, linked to the user. Each row stores one character's stroke data.

3. **Using the font** -- In the letter composer, a new "My Handwriting" option appears in the customization bar. When toggled on, typed text is rendered character-by-character using the saved SVG glyphs instead of a browser font.

## User Flow

- User navigates to "Create My Font" (accessible from the Write page or profile)
- They see a grid of characters, each with a small canvas
- They draw each letter, with undo/clear per cell
- They save the font (requires sign-in)
- Back on the Write page, "My Handwriting" appears as a font toggle in the customization options
- Typed text renders in their handwriting in real-time

## Technical Plan

### 1. Database: `custom_font_glyphs` table

New migration with:
- `id` (uuid, PK)
- `user_id` (uuid, not null)
- `character` (text, not null) -- the character this glyph represents (e.g. "A", "a", "1")
- `stroke_data` (text, not null) -- serialized stroke JSON (same format as sketch canvas)
- `created_at`, `updated_at` (timestamps)
- Unique constraint on `(user_id, character)`
- RLS policies: users can only CRUD their own glyphs

### 2. New Components

**`src/pages/CreateFont.tsx`** -- Full page with:
- Grid of character cells organized by section (uppercase, lowercase, digits, punctuation)
- Each cell contains a mini `FreehandCanvas` (~80x100px viewBox) 
- Per-cell undo/clear buttons
- "Save Font" button that upserts all drawn glyphs to the database
- Progress indicator showing how many characters have been drawn

**`src/components/HandwritingRenderer.tsx`** -- Component that:
- Takes a string of text and the user's glyph data
- Renders each character as an inline SVG using the stored stroke paths
- Handles spacing, line wrapping, and missing characters (falls back to a regular font)
- Matches the current ink color and paper styling

**`src/hooks/useCustomFont.ts`** -- Hook that:
- Fetches the user's saved glyphs from the database
- Caches them via React Query
- Provides a `hasCustomFont` boolean and a `glyphMap` (character -> stroke data)

### 3. WriteLetter Integration

- Add a "My Handwriting" toggle in the customization bar (next to Lines toggle)
- Only visible when the user has a saved custom font
- When enabled in "type" mode, the `<Textarea>` is replaced with a `<HandwritingRenderer>` that converts typed input into hand-drawn glyphs
- The actual text content is still stored as plain text -- only the rendering changes

### 4. Routing

- Add `/create-font` route (protected, requires auth)
- Add a link/button to it from the Write page customization area

### 5. Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/...custom_font_glyphs.sql` | Create table + RLS |
| `src/pages/CreateFont.tsx` | New page with character grid |
| `src/components/HandwritingRenderer.tsx` | New text renderer using glyphs |
| `src/components/GlyphCell.tsx` | Small canvas cell for one character |
| `src/hooks/useCustomFont.ts` | New hook for font CRUD |
| `src/pages/WriteLetter.tsx` | Add "My Handwriting" toggle + renderer |
| `src/App.tsx` | Add `/create-font` route |
| `src/components/SketchRenderer.tsx` | Minor reuse of SVG path utilities |

