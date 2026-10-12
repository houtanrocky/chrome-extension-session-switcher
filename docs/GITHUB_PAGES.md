# GitHub Pages deployment

This homepage is a buildless static site in `docs/`. The repository includes `.github/workflows/pages.yml`, which deploys changes to `docs/` from the `main` branch. Enable GitHub Actions as the Pages source:

1. Open **Settings  Pages**.
2. Under **Build and deployment**, choose **GitHub Actions**.
3. Push the repository's `main` branch and open the workflow run under **Actions**.
4. Wait for the Pages deployment and open `https://houtan-rocky.github.io/chrome-extension-session-switcher/`.

The page uses relative assets from `docs/assets/`, so it works as a project site under the repository path. Update the canonical, Open Graph, Twitter, sitemap, and structured-data URLs in `docs/index.html`, `docs/robots.txt`, and `docs/sitemap.xml` if the repository owner or name changes.

The Chrome Web Store buttons point to the direct listing URL: https://chromewebstore.google.com/detail/session-switcher/ibleijinnlbhcpkgcccfmakidclplgga.

Use `https://houtan-rocky.github.io/chrome-extension-session-switcher/support.html` as the Chrome Web Store **Support URL**. It links visitors to structured bug and support ticket forms in this repository.

Keep docs/PRIVACY.md and docs/CHANGELOG.md synchronized with their root files when those documents change.


