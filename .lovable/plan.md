

## Close Letter Modal by Clicking Outside

### Problem
When viewing an opened letter in the vault, the only way to close it is by scrolling to the bottom and pressing the "Close" button. This is poor UX, especially for long letters.

### Solution
Add click-outside-to-close behavior on the backdrop overlay, so tapping/clicking anywhere outside the letter content dismisses the modal.

### Technical Details

**File: `src/components/EnvelopeOpening.tsx`**

1. Add an `onClick={onClose}` handler to the outer backdrop `motion.div` (the dark overlay).
2. Add `onClick={(e) => e.stopPropagation()}` to the inner letter card `motion.div` to prevent clicks on the letter content from bubbling up and closing the modal.

This is a minimal, two-line change that follows standard modal dismiss patterns.
