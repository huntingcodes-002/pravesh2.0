You are tasked with replacing the hardcoded latitude/longitude that the main applicant and co-applicant address-details pages currently send to the backend with real coordinates captured from the browser.

Context:
- `app/lead/address-details/page.tsx` and `app/lead/co-applicant/address-details/page.tsx` both build payloads with `latitude: '-90'` and `longitude: '90'`.
- These pages already run as Client Components.
- We want to prompt the browser for geolocation, surface basic status to the user, and persist the captured coordinates alongside each address before submitting.

Requirements:
1. Extend both address-page components so each `Address` object carries `latitude` and `longitude` fields (string or number). Default to empty strings.
2. Add a small client-only helper inside each page (no separate file) that:
   - Triggers `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: true`.
   - Writes the returned `coords.latitude` and `coords.longitude` into the currently edited address entry.
   - Tracks basic status: waiting / success / error, and shows a short inline message near the primary action area.
   - Offers a single “Capture Current Location” button beside the postal-code section that refreshes the coordinates for that address.
   - If location access fails, retains the prior values and shows the error message.
3. Update `handleSave` payloads to send the stored per-address `latitude` and `longitude` values instead of the hardcoded strings. If the fields are still empty, fall back to the previous sentinel values (`'-90'` and `'90'`) so existing behavior is preserved when the user skips location capture.
4. For the main applicant flow, ensure the coordinate state survives OCR auto-fill and manual edits.
5. For the co-applicant flow, mirror the same UX and data handling; there may be multiple addresses—each gets its own capture button and state.

Deliverables:
- Updated `app/lead/address-details/page.tsx`.
- Updated `app/lead/co-applicant/address-details/page.tsx`.

After implementing:
- Verify that saving either page without capturing a location still succeeds and sends the sentinel values.
- Verify that capturing a location replaces the sentinel values with real coordinates in the submitted payload.