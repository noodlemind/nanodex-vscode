# Publishing nanodex Extension

This guide covers distributing the nanodex VS Code extension through multiple channels.

## Distribution Channels

### 1. VS Code Marketplace (Recommended)

**Setup (One-time):**

1. Create a publisher account:
   - Visit https://marketplace.visualstudio.com/manage
   - Sign in with Microsoft/Azure account
   - Create publisher with ID `nanodex` (already configured in package.json)

2. Generate Personal Access Token (PAT):
   - Go to https://dev.azure.com/
   - Click User Settings → Personal Access Tokens
   - Create new token with:
     - Organization: All accessible organizations
     - Scopes: Marketplace → Manage
     - Expiration: Custom (recommend 1 year)
   - Save token securely (can't view again)

3. Login with vsce:
   ```bash
   cd extension
   pnpm exec vsce login nanodex
   # Enter your PAT when prompted
   ```

**Publishing:**

```bash
cd extension

# Bump version (choose one)
npm version patch  # 0.5.0 → 0.5.1
npm version minor  # 0.5.0 → 0.6.0
npm version major  # 0.5.0 → 1.0.0

# Build and publish
pnpm run build
pnpm exec vsce publish

# Or publish specific version
pnpm exec vsce publish minor
pnpm exec vsce publish 1.0.0
```

**Users install via:**
```
ext install nanodex.nanodex
```

---

### 2. GitHub Releases (Direct VSIX Download)

**For maintainers:**

1. Create release package:
   ```bash
   cd extension

   # Build extension
   pnpm run build

   # Package without dependencies (we'll add manually)
   pnpm exec vsce package --no-dependencies

   # Rebuild native module for Electron 37 (VS Code 1.105+)
   npx @electron/rebuild --version=37.6.0 \
     --module-dir=../node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3

   # Repackage with dependencies
   mkdir -p vsix_extract
   cd vsix_extract
   unzip -q ../nanodex-0.5.0.vsix

   mkdir -p extension/node_modules
   cp -r ../../node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3 extension/node_modules/
   cp -r ../../node_modules/.pnpm/js-yaml@4.1.1/node_modules/js-yaml extension/node_modules/

   cd ..
   rm nanodex-0.5.0.vsix
   cd vsix_extract
   zip -q -r ../nanodex-0.5.0.vsix .
   cd ..
   rm -rf vsix_extract

   # Verify package size
   ls -lh nanodex-0.5.0.vsix
   ```

2. Create GitHub Release:
   ```bash
   # Tag the release
   git tag -a v0.5.0 -m "Release v0.5.0"
   git push origin v0.5.0

   # Create release on GitHub
   gh release create v0.5.0 \
     extension/nanodex-0.5.0.vsix \
     --title "v0.5.0" \
     --notes "Release notes here"
   ```

**Users install via:**
```bash
# Download from GitHub Releases
# https://github.com/nanodex/nanodex-vscode/releases

# Install manually
code --install-extension nanodex-0.5.0.vsix
```

---

## Automated Publishing with GitHub Actions

Create `.github/workflows/publish.yml` for automated releases:

```yaml
name: Publish Extension

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'
          cache-dependency-path: extension/pnpm-lock.yaml

      - name: Install dependencies
        run: |
          cd extension
          pnpm install

      - name: Build extension
        run: |
          cd extension
          pnpm run build

      - name: Rebuild native modules
        run: |
          cd extension
          npx @electron/rebuild --version=37.6.0 \
            --module-dir=../node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3

      - name: Package extension
        run: |
          cd extension
          pnpm exec vsce package --no-dependencies

          # Add dependencies manually
          mkdir -p vsix_extract
          cd vsix_extract
          unzip -q ../nanodex-*.vsix
          mkdir -p extension/node_modules
          cp -r ../../node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3 extension/node_modules/
          cp -r ../../node_modules/.pnpm/js-yaml@4.1.1/node_modules/js-yaml extension/node_modules/
          cd ..
          rm nanodex-*.vsix
          cd vsix_extract
          zip -q -r ../nanodex-${{ github.ref_name }}.vsix .
          cd ..
          rm -rf vsix_extract

      - name: Publish to Marketplace
        if: success()
        run: |
          cd extension
          pnpm exec vsce publish --packagePath nanodex-*.vsix
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: extension/nanodex-*.vsix
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Setup secrets:**
- Go to GitHub repo → Settings → Secrets and variables → Actions
- Add `VSCE_PAT` with your Azure DevOps Personal Access Token

---

## Version Management

**Version Format:** `MAJOR.MINOR.PATCH` (Semantic Versioning)

- **PATCH** (0.5.0 → 0.5.1): Bug fixes, small improvements
- **MINOR** (0.5.0 → 0.6.0): New features, backward compatible
- **MAJOR** (0.5.0 → 1.0.0): Breaking changes

**Update version:**
```bash
cd extension
npm version patch  # or minor, major
git push --follow-tags
```

---

## Pre-release Versions

For beta testing before marketplace publish:

```bash
cd extension

# Create pre-release version
npm version 0.6.0-beta.1

# Package
pnpm exec vsce package --no-dependencies
# ... add dependencies as shown above ...

# Publish to GitHub only
git tag -a v0.6.0-beta.1 -m "Beta release"
git push origin v0.6.0-beta.1
gh release create v0.6.0-beta.1 --prerelease
```

---

## Checklist Before Publishing

- [ ] All tests pass
- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] Icon and README look good
- [ ] Extension tested locally (`code --install-extension nanodex-x.x.x.vsix`)
- [ ] Native modules rebuilt for Electron 37
- [ ] LICENSE file present

---

## Troubleshooting

**Native module errors:**
- Ensure better-sqlite3 rebuilt for Electron 37.6.0
- Check NODE_MODULE_VERSION matches VS Code version

**Marketplace publishing fails:**
- Verify PAT hasn't expired
- Check publisher name matches package.json
- Ensure icon.png is under 1MB

**Large package size:**
- Review included files with `vsce ls --tree`
- Add unwanted files to `.vscodeignore`
