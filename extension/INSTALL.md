# Installing nanodex Extension

There are three ways to install the nanodex VS Code extension:

## Method 1: VS Code Marketplace (Recommended)

**Install from VS Code:**
1. Open VS Code
2. Go to Extensions (Cmd+Shift+X / Ctrl+Shift+X)
3. Search for "nanodex"
4. Click "Install"

**Install from command line:**
```bash
code --install-extension nanodex.nanodex
```

**Benefits:**
- Automatic updates
- Easy discovery
- One-click install

---

## Method 2: GitHub Releases (Direct VSIX)

**For beta testing or offline installation:**

1. Download the latest `.vsix` file:
   - Visit https://github.com/nanodex/nanodex-vscode/releases
   - Download `nanodex-x.x.x.vsix` from the latest release

2. Install the VSIX:

   **Option A: Command line**
   ```bash
   code --install-extension nanodex-0.5.0.vsix
   ```

   **Option B: VS Code UI**
   - Open VS Code
   - Go to Extensions view
   - Click `...` (More Actions) → Install from VSIX...
   - Select the downloaded `.vsix` file

3. Reload VS Code when prompted

**Benefits:**
- Test pre-release versions
- Offline installation
- Enterprise deployment
- Pinned versions

---

## Method 3: Build from Source

**For development or customization:**

```bash
# Clone the repository
git clone https://github.com/nanodex/nanodex-vscode.git
cd nanodex-vscode

# Install dependencies
pnpm install

# Rebuild native modules for your VS Code version
npx @electron/rebuild --version=37.6.0 \
  --module-dir=node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3

# Build extension
cd extension
pnpm run build

# Package
pnpm exec vsce package --no-dependencies

# Add dependencies (see PUBLISHING.md for full steps)
# ...

# Install locally
code --install-extension nanodex-0.5.0.vsix
```

---

## System Requirements

- **VS Code**: Version 1.105.0 or higher
- **Node.js**: 18.0.0 or higher (for development only)
- **Operating Systems**:
  - macOS (Intel & Apple Silicon)
  - Windows 10/11
  - Linux (Ubuntu, Fedora, etc.)

---

## First Run

After installation:

1. **Reload VS Code** - Click "Reload" when prompted

2. **Open workspace** - nanodex works best with workspace folders

3. **Index your codebase** - Run command:
   ```
   Nanodex: Index Workspace
   ```

4. **Try commands**:
   - `Nanodex: Plan` - Create implementation plans
   - `Nanodex: Work` - Execute work from plans
   - `@nanodex` in Chat - Chat with knowledge graph context

---

## Troubleshooting

### Extension not loading

**Check VS Code version:**
```bash
code --version
```
Must be 1.105.0 or higher.

**Check extension installed:**
```bash
code --list-extensions | grep nanodex
```

### Native module errors

If you see errors about `better_sqlite3.node`:

1. Your VS Code version might be incompatible
2. Try reinstalling the extension
3. Check issue tracker: https://github.com/nanodex/nanodex-vscode/issues

### Database locked errors

If you get "database is locked":
- Close other nanodex operations
- Wait a moment and retry
- Restart VS Code if persistent

---

## Uninstalling

**From VS Code:**
1. Go to Extensions
2. Find "nanodex"
3. Click Uninstall

**From command line:**
```bash
code --uninstall-extension nanodex.nanodex
```

The extension data in `.nanodex/` will remain in your workspace. Delete manually if desired:
```bash
rm -rf .nanodex/
```

---

## Updating

**Marketplace installations:**
- Auto-updates enabled by default
- Manual check: Extensions → nanodex → Check for Updates

**VSIX installations:**
- Download new `.vsix` from GitHub Releases
- Install over existing (keeps settings)

---

## Support

- **Documentation**: https://github.com/nanodex/nanodex-vscode
- **Issues**: https://github.com/nanodex/nanodex-vscode/issues
- **Discussions**: https://github.com/nanodex/nanodex-vscode/discussions
