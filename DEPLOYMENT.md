# Cloudflare Pages — clean Git deployment

## 1. Create a new Git-connected Pages project

In Cloudflare: **Workers & Pages → Create → Pages (Continue to Pages if necessary) → Import an existing Git repository → GitHub**. Select **mohsin-builds/utility-platform**, production branch `main`. If it does not appear, expand repository permissions for the Cloudflare GitHub app, preserving access to any other existing repositories.

Use:
- Framework: **None**
- Build command: **`node scripts/build.mjs`**
- Output directory: **`dist`**
- Root directory: repository root
- No build environment variables or secrets required.

Confirm the precise `*.pages.dev` hostname on the successful build screen. Do not assume the project name guarantees a particular available hostname.

## 2. Verify before retiring old hosting

Smoke-test home, responsive layout, several original tools, new Document Pack Builder with an actual image and PDF, ZIP download, privacy page, robots.txt, sitemap.xml, and security headers. Validate future commits cause automatic deployments. Check Cloudflare's build log on failure.

## 3. Avoid an abrupt SEO cutover

The new site's initial SEO metadata is deliberately still canonical to `https://tools.mohsinlabs.com` until the production URL is verified. Do **not** delete the previous Pages project immediately. Once the replacement works, review the preferred new public hostname, configure permanent **one-to-one redirects** from the old URLs (including `/tools/...`) to the new URLs, and only then run:

```bash
node scripts/switch-domain.mjs https://confirmed-new-project.pages.dev
```

Review the resulting changes in canonical URLs, OpenGraph, structured data, `robots.txt`, and `sitemap.xml`; commit to GitHub and verify the new live responses. The old domain can remain in the Cloudflare account solely to serve redirects if desired. Search ranking continuity cannot be guaranteed.

## 4. Later custom domain

When the brand and purchased domain are ready, add it via **Pages → Custom domains** and repeat a careful redirect/canonical/sitemap migration. Do not purchase a domain automatically.

## What's deliberately not done

- No automatic deletion of the old `mohsin-tools-app` Cloudflare project.
- No changes to `tools.mohsinlabs.com` DNS or existing live website.
- No claim that a new Pages site is deployed until Cloudflare reports success and real functionality is tested.
