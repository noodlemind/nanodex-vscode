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

   # Package extension (automatically includes dependencies)
   pnpm run package

   # Verify package size
   ls -lh nanodex-*.vsix
   ```

   The `pnpm run package` command automatically:
   - Builds the extension
   - Packages without dependencies initially
   - Extracts the VSIX
   - Copies all runtime dependencies (resolving pnpm symlinks)
   - Includes all transitive dependencies
   - Repackages the VSIX with dependencies bundled

   No manual dependency copying needed!

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

      - name: Package extension
        run: |
          cd extension
          pnpm run package

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

# Package (dependencies automatically included)
pnpm run package

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
- [ ] LICENSE file present
- [ ] Dependencies bundled correctly (verify VSIX size ~4MB)

---

## Troubleshooting

**Packaging errors:**
- Ensure `pnpm install` has been run to install all dependencies including `adm-zip`
- Check that `scripts/package-vsix.cjs` exists and is executable
- Verify workspace structure (extension should be in monorepo with pnpm workspace)

**Native module errors:**
- The packaging script automatically includes the pre-built better-sqlite3 binary
- If you see native module errors, ensure you're using the packaged VSIX (not running from source)
- VS Code uses Electron 37.6.0 (v1.105+) - the pre-built binaries should work

**Marketplace publishing fails:**
- Verify PAT hasn't expired
- Check publisher name matches package.json
- Ensure icon.png is under 1MB

**Large package size:**
- Expected size is ~4MB (includes better-sqlite3 native binary and all dependencies)
- Review included files: `unzip -l nanodex-*.vsix | less`
- Add unwanted files to `.vscodeignore` if needed
