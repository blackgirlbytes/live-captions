# Publish Heard in the Chrome Web Store

This guide prepares the extension package and listing for a first release or an updated submission. Read the [listing reference](chrome-web-store-listing.md) for text to enter in the dashboard.

## Prepare the release

1. Confirm that `DEEPGRAM_API_KEY` is **unset** on every public Heard deployment. Do not add the owner's key to the extension build, the Chrome Web Store, CI, or a hosting dashboard. A published extension works with each user's own Deepgram key.
2. Run `npm install`, `npm test`, `npm run typecheck`, and `npm run build -w @heard/extension` from the repository root.
3. Load `apps/extension/.output/chrome-mv3` through `chrome://extensions` and run the [extension manual test checklist](../apps/extension/README.md#manual-test-checklist). Test with a dedicated user key and no Heard server. Check start, stop, audio playback, captions, transcript export, translation, live dubbing, and recovery after navigation. Confirm a failed connection clears the LIVE badge.
4. Deploy the web app changes, then open `https://live-captions-zeta.vercel.app/extension/privacy`. Confirm that the policy is public and that the home page links to it from the Privacy tab. Also check that `GET /api/deepgram/token` on the public site reports `{"serverKey":false}`.
5. Review `docs/store-assets/heard-extension-session-1280x800.png` against the current extension UI. It combines two real captures from a caption session. Confirm that the transcript is suitable for public display and that no key or private text appears. Capture an additional real screenshot of the current **Settings → Live dubbing** controls if you want to feature dubbing. Use the sizes in the [image guidance](https://developer.chrome.com/docs/webstore/images).
6. Run `npm run zip -w @heard/extension`. Upload `apps/extension/.output/heardextension-0.2.0-chrome.zip`. The ZIP must contain `manifest.json` at its root. This release is version 0.2.0 because live dubbing was added after the earlier package; increase the version again before a later upload.

## Fill out the dashboard

1. Register or sign in to a Chrome Web Store developer account with two-step verification. In the dashboard's **Settings** or **Account** page, add the publisher contact email, request verification, and open the verification link sent to that mailbox. Refresh the dashboard and confirm the email shows as verified. This account step cannot be completed from the extension package.
2. In the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole), open the existing Heard item and upload the 0.2.0 ZIP as a new package. Use **Add new item** only if Heard has not been created there yet.
3. Copy the updated product details and six permission explanations from the [listing reference](chrome-web-store-listing.md). Upload the 128 × 128 icon and at least one real screenshot. Fill in support and homepage URLs.
4. In **Privacy practices**, enter the single-purpose description and the public privacy policy URL. Review each data category against the shipped extension, including optional dubbing. Complete the Limited Use certification only when the answers match the policy and code.
5. In **Test instructions**, explain the Deepgram key setup, how to start captions, and how to try dubbing. If reviewers need a key, provide a separate limited, expiring test key only in the dashboard's private reviewer field; never use the owner's key.
6. Choose the distribution settings and submit the item for review. Review the dashboard's warnings before publication.

The Chrome Web Store can reject a listing with missing screenshots, inaccurate privacy answers, or a description that hides the key requirement. The publisher controls the account, listing, images, and final submission.

## Sources

- [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare)
- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- [Complete your listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Set up the developer account and verify its contact email](https://developer.chrome.com/docs/webstore/set-up-account)
