# Publish Heard in the Chrome Web Store

This guide prepares the extension package and listing for a first release. Read the [listing reference](chrome-web-store-listing.md) for text to enter in the dashboard.

## Prepare the release

1. Confirm that `DEEPGRAM_API_KEY` is **unset** on every public Heard deployment. Do not add the owner's key to the extension build, the Chrome Web Store, CI, or a hosting dashboard. A published extension works with each user's own Deepgram key.
2. Run `npm install`, `npm test`, `npm run typecheck`, and `npm run build -w @heard/extension` from the repository root.
3. Load `apps/extension/.output/chrome-mv3` through `chrome://extensions` and run the [extension manual test checklist](../apps/extension/README.md#manual-test-checklist). Test with a dedicated user key and no Heard server. Check start, stop, audio playback, captions, transcript export, translation, and recovery after navigation.
4. Deploy the web app changes, then open `https://live-captions-zeta.vercel.app/extension/privacy`. Confirm that the policy is public and that the home page links to it from the Privacy tab. Also check that `GET /api/deepgram/token` on the public site reports `{"serverKey":false}`.
5. Capture real screenshots that show the current extension UI. Keep private audio, transcript text, and keys out of the images. Use the sizes in the [image guidance](https://developer.chrome.com/docs/webstore/images).
6. Run `npm run zip -w @heard/extension`. Upload `apps/extension/.output/heardextension-0.1.0-chrome.zip`. The ZIP must contain `manifest.json` at its root. Increase `apps/extension/package.json`'s version before any later upload.

## Fill out the dashboard

1. Register or sign in to a Chrome Web Store developer account with two-step verification.
2. In the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole), choose **Add new item** and upload the ZIP.
3. Copy the product details and permission explanations from the [listing reference](chrome-web-store-listing.md). Upload the 128 × 128 icon and at least one real screenshot. Fill in support and homepage URLs.
4. In **Privacy**, enter the public privacy policy URL. Review each data category against the shipped extension. Complete the Limited Use certification only when the answers match the policy and code.
5. In **Test instructions**, explain the Deepgram key setup and how to start captions. Add a dedicated review credential only if you choose to provide one through the private dashboard field.
6. Choose the distribution settings and submit the item for review. Review the dashboard's warnings before publication.

The Chrome Web Store can reject a listing with missing screenshots, inaccurate privacy answers, or a description that hides the key requirement. The publisher controls the account, listing, images, and final submission.

## Sources

- [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare)
- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- [Complete your listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
