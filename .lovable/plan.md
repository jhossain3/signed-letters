
# Plan: Persist Sketch Data to Draft

## Summary
Add sketch pages to the draft persistence system so handwritten content survives the authentication redirect.

---

## Implementation Steps

### 1. Update Draft Interface
Add the `sketchPages` field to store serialized stroke data for each sketch page.

**File:** `src/pages/WriteLetter.tsx`

```typescript
interface LetterDraft {
  // ... existing fields ...
  sketchPages: string[];  // Add this
}
```

### 2. Save Sketch Pages in Draft
Include `sketchPages` when saving the draft before auth redirect.

**In the `saveDraft` function:**
- Add `sketchPages` to the draft object

### 3. Restore Sketch Pages on Mount
When restoring a draft, load the sketch pages and set state.

**In the restoration `useEffect`:**
- Add `setSketchPages(draft.sketchPages.length > 0 ? draft.sketchPages : [""])`

### 4. Pass Initial Data to SketchCanvas
Each sketch canvas needs to receive its saved strokes so it can render them.

**In the sketch page render loop:**
- Add `initialData={sketchPages[pageIndex]}` prop to each `SketchCanvas`

---

## Technical Notes

- Sketch strokes are already serialized as JSON arrays (e.g., `[{points: [[x,y],...], color: "...", size: 3}]`)
- localStorage has a ~5MB limit — sufficient for typical handwritten letters
- The compact serialization already minimizes storage footprint
- No async operations needed since `sketchPages` state already contains the serialized strings

---

## Estimated Changes

| File | Changes |
|------|---------|
| `src/pages/WriteLetter.tsx` | ~10 lines |

