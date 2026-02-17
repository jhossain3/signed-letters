

## Auto-Save Draft on Every Change

Currently, letter drafts are only saved to localStorage when an unauthenticated user clicks "Seal." This change will make the draft auto-save continuously as the user types or makes any change, protecting against accidental tab closures or page refreshes.

### What Will Change

- Every change to the letter (title, body text, signature, delivery date, recipient info, sketch data, photos, settings) will be automatically saved to localStorage
- On page load, any saved draft will be restored (existing behavior, but now drafts will always be present if the user was writing)
- The draft will only be cleared after a successful seal, not on restore (so refreshing keeps the draft)
- A subtle "Draft saved" indicator is not included to keep the UI clean, but can be added later if desired

### Technical Details

**File: `src/pages/WriteLetter.tsx`**

1. Add a new `useEffect` that watches all draft-relevant state values and calls `saveDraft()` on every change
2. Skip saving until the initial draft has been loaded (using the existing `draftLoaded` flag) to avoid overwriting a saved draft with empty defaults
3. On restore, do NOT clear the draft from localStorage immediately -- only clear it after successful seal (change existing restore logic to remove the `localStorage.removeItem` call and the toast on restore, replacing it with a silent restore)
4. Keep the existing `clearDraft()` call in `completeSeal` for cleanup after successful save

The effect will look like:

```typescript
// Auto-save draft to localStorage on every change
useEffect(() => {
  if (!draftLoaded) return; // Don't save until initial restore is complete
  saveDraft();
}, [draftLoaded, saveDraft]);
```

Since `saveDraft` is already a `useCallback` with all the relevant state in its dependency array, it will be called whenever any field changes. The existing quota-exceeded retry logic is preserved.

No other files need to change.
