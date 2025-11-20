#!/usr/bin/env node

/**
 * Package VSIX with dependencies
 * 
 * This script automates the VSIX packaging process with proper dependency bundling.
 * It packages the extension without dependencies first, then adds them manually.
 * 
 * Context: pnpm uses symlinks which don't work in VSIX packages when using vsce --dependencies.
 * This script resolves symlinks and bundles actual dependency files into the VSIX.
 * 
 * Supports platform-specific builds for cross-platform compatibility with native modules.
 * 
 * Usage:
 *   node package-vsix.cjs [--target <platform>] [--all-platforms]
 * 
 * Examples:
 *   node package-vsix.cjs                    # Build for current platform
 *   node package-vsix.cjs --target win32-x64  # Build for specific platform
 *   node package-vsix.cjs --all-platforms     # Build for all major platforms
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

const extensionDir = path.resolve(__dirname, '..');
const packageJson = require(path.join(extensionDir, 'package.json'));

// Parse command-line arguments
const args = process.argv.slice(2);
let targetPlatform = null;
let buildAllPlatforms = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--target' && i + 1 < args.length) {
    targetPlatform = args[i + 1];
    i++;
  } else if (args[i] === '--all-platforms') {
    buildAllPlatforms = true;
  }
}

// Major platforms for marketplace distribution
const PLATFORMS = [
  'win32-x64',
  'win32-arm64',
  'linux-x64',
  'linux-arm64',
  'darwin-x64',
  'darwin-arm64'
];

if (buildAllPlatforms) {
  console.log('Building VSIX packages for all platforms...');
  for (const platform of PLATFORMS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Building for platform: ${platform}`);
    console.log('='.repeat(60));
    buildForPlatform(platform);
  }
  console.log(`\n${'='.repeat(60)}`);
  console.log('All platform builds complete!');
  console.log('='.repeat(60));
  process.exit(0);
}

const platform = targetPlatform || 'universal';
buildForPlatform(platform);

function buildForPlatform(targetPlatform) {
  const version = packageJson.version;
  const vsixName = targetPlatform === 'universal' 
    ? `nanodex-${version}.vsix`
    : `nanodex-${targetPlatform}-${version}.vsix`;
  const vsixPath = path.join(extensionDir, vsixName);

  console.log(`Building VSIX package with dependencies for ${targetPlatform}...`);
  console.log(`Package: ${vsixName}`);

  // Step 1: Package without dependencies
  console.log('\n1. Packaging extension (without dependencies)...');
  try {
    const vscePlatformFlag = targetPlatform !== 'universal' ? `--target ${targetPlatform}` : '';
    execSync(`pnpm exec vsce package --no-dependencies ${vscePlatformFlag}`, {
      cwd: extensionDir,
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('Failed to package extension');
    process.exit(1);
  }

  // Step 2: Extract VSIX
  console.log('\n2. Extracting VSIX...');
  const extractDir = path.join(extensionDir, '.vsix_temp');
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    const zip = new AdmZip(vsixPath);
    zip.extractAllTo(extractDir, true);
  } catch (error) {
    console.error('Failed to extract VSIX:', error.message);
    process.exit(1);
  }

  // Step 3: Copy dependencies
  console.log('\n3. Adding dependencies...');
  const extensionContentDir = path.join(extractDir, 'extension');
  const targetNodeModules = path.join(extensionContentDir, 'node_modules');

  if (!fs.existsSync(targetNodeModules)) {
    fs.mkdirSync(targetNodeModules, { recursive: true });
  }

  /**
   * Copy a directory recursively, resolving symlinks
   */
  function copyDirRecursive(src, dest) {
    // Resolve symlinks
    const realSrc = fs.realpathSync(src);
    const stats = fs.statSync(realSrc);
    
    if (stats.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      
      const entries = fs.readdirSync(realSrc);
      for (const entry of entries) {
        copyDirRecursive(
          path.join(realSrc, entry),
          path.join(dest, entry)
        );
      }
    } else {
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(realSrc, dest);
    }
  }

  /**
   * Download and prepare better-sqlite3 for a specific platform
   */
  function prepareBetterSqlite3ForPlatform(targetPlatform) {
    if (targetPlatform === 'universal') {
      console.log('  Note: Universal build will use current platform binary');
      return; // Use existing binary
    }

    console.log(`  Preparing better-sqlite3 for ${targetPlatform}...`);
    
    // Map VS Code platform names to Node/Electron platform naming
    const platformMap = {
      'win32-x64': { platform: 'win32', arch: 'x64' },
      'win32-arm64': { platform: 'win32', arch: 'arm64' },
      'linux-x64': { platform: 'linux', arch: 'x64' },
      'linux-arm64': { platform: 'linux', arch: 'arm64' },
      'linux-armhf': { platform: 'linux', arch: 'arm' },
      'darwin-x64': { platform: 'darwin', arch: 'x64' },
      'darwin-arm64': { platform: 'darwin', arch: 'arm64' },
      'alpine-x64': { platform: 'linux', arch: 'x64', libc: 'musl' },
      'alpine-arm64': { platform: 'linux', arch: 'arm64', libc: 'musl' }
    };

    const platformInfo = platformMap[targetPlatform];
    if (!platformInfo) {
      console.warn(`  Warning: Unknown platform ${targetPlatform}, using current platform binary`);
      return;
    }

    // Get better-sqlite3 version
    const betterSqlite3Path = path.join(extensionDir, 'node_modules', 'better-sqlite3');
    const betterSqlite3PkgJson = JSON.parse(
      fs.readFileSync(path.join(fs.realpathSync(betterSqlite3Path), 'package.json'), 'utf-8')
    );
    const version = betterSqlite3PkgJson.version;

    // VS Code uses Electron, get the ABI version
    // For VS Code 1.105+, it uses Electron 37
    const electronABI = '129'; // Electron 37 ABI version

    console.log(`    Version: ${version}, Electron ABI: ${electronABI}`);
    console.log(`    Target: ${platformInfo.platform}-${platformInfo.arch}`);

    try {
      // Use prebuild-install to download the correct prebuild
      const env = {
        ...process.env,
        npm_config_target: electronABI,
        npm_config_arch: platformInfo.arch,
        npm_config_target_arch: platformInfo.arch,
        npm_config_platform: platformInfo.platform,
        npm_config_build_from_source: 'false'
      };

      if (platformInfo.libc) {
        env.npm_config_libc = platformInfo.libc;
      }

      const betterSqlite3RealPath = fs.realpathSync(betterSqlite3Path);
      const prebuildInstallPath = path.join(extensionDir, 'node_modules', '.bin', 'prebuild-install');

      // Run prebuild-install in better-sqlite3 directory
      execSync(`node "${prebuildInstallPath}" --runtime electron --target ${electronABI}`, {
        cwd: betterSqlite3RealPath,
        env,
        stdio: 'pipe'
      });

      console.log(`    ✓ Downloaded prebuild for ${targetPlatform}`);
    } catch (error) {
      console.warn(`    Warning: Could not download prebuild for ${targetPlatform}: ${error.message}`);
      console.warn(`    The extension may not work on ${targetPlatform}`);
    }
  }

  /**
   * Get all dependencies (including transitive) for a package
   * Returns a Map of depName -> depPath
   */
  function getAllDependencies(packagePath) {
    const allDeps = new Map(); // depName -> path where it was found
    const visited = new Set();
  
    function collectDeps(pkgPath) {
      const pkgJsonPath = path.join(pkgPath, 'package.json');
      
      if (!fs.existsSync(pkgJsonPath) || visited.has(pkgPath)) {
        return;
      }
      
      visited.add(pkgPath);
      
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      const deps = pkgJson.dependencies || {};
      
      for (const depName of Object.keys(deps)) {
        if (!allDeps.has(depName)) {
          // Look for this dependency in multiple locations
          const searchPaths = [
            path.join(pkgPath, 'node_modules', depName),
            path.join(extensionDir, 'node_modules', depName),
            // pnpm workspace root
            path.join(extensionDir, '..', 'node_modules', depName),
            // pnpm sibling packages (for packages in .pnpm store)
            // If pkgPath is like .../node_modules/.pnpm/pkg@version/node_modules/pkg
            // then deps are at .../node_modules/.pnpm/pkg@version/node_modules/depName
            path.join(pkgPath, '..', depName)
          ];
          
          for (const depPath of searchPaths) {
            if (fs.existsSync(depPath)) {
              const realDepPath = fs.realpathSync(depPath);
              allDeps.set(depName, realDepPath);
              collectDeps(realDepPath);
              break;
            }
          }
        }
      }
    }
    
    collectDeps(packagePath);
    return allDeps;
  }

  // Prepare platform-specific binaries for better-sqlite3
  prepareBetterSqlite3ForPlatform(targetPlatform);

  // Copy each production dependency and their transitive dependencies
  const dependencies = packageJson.dependencies || {};
  const allDepsMap = new Map(); // depName -> path

  // First, collect all dependencies
  for (const depName of Object.keys(dependencies)) {
    const depSource = path.join(extensionDir, 'node_modules', depName);
    
    if (!fs.existsSync(depSource)) {
      console.error(`Error: Dependency ${depName} not found`);
      process.exit(1);
    }
    
    const realDepPath = fs.realpathSync(depSource);
    allDepsMap.set(depName, realDepPath);
    
    // Get transitive dependencies
    const transitiveDeps = getAllDependencies(realDepPath);
    for (const [transDep, transDepPath] of transitiveDeps) {
      if (!allDepsMap.has(transDep)) {
        allDepsMap.set(transDep, transDepPath);
      }
    }
  }

  // Now copy all collected dependencies
  console.log(`  Found ${allDepsMap.size} total dependencies (including transitive)`);
  for (const [depName, depSource] of allDepsMap) {
    console.log(`  Copying ${depName}...`);
    const depDest = path.join(targetNodeModules, depName);
    copyDirRecursive(depSource, depDest);
  }

  // Step 4: Repackage VSIX
  console.log('\n4. Repackaging VSIX with dependencies...');

  // Delete old VSIX
  fs.unlinkSync(vsixPath);

  // Create new VSIX with dependencies
  try {
    const newZip = new AdmZip();
    
    // Add all files from extract directory
    function addDirectoryToZip(zip, dirPath, zipPath = '') {
      const entries = fs.readdirSync(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const zipEntryPath = zipPath ? path.join(zipPath, entry) : entry;
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          addDirectoryToZip(zip, fullPath, zipEntryPath);
        } else {
          const zipDir = path.dirname(zipEntryPath);
          zip.addLocalFile(fullPath, zipDir === '.' ? undefined : zipDir);
        }
      }
    }
    
    addDirectoryToZip(newZip, extractDir);
    newZip.writeZip(vsixPath);
  } catch (error) {
    console.error('Failed to repackage VSIX:', error.message);
    process.exit(1);
  }

  // Step 5: Clean up
  console.log('\n5. Cleaning up...');
  fs.rmSync(extractDir, { recursive: true, force: true });

  // Step 6: Verify package
  console.log('\n6. Package complete!');
  const stats = fs.statSync(vsixPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`  File: ${vsixPath}`);
  console.log(`  Size: ${sizeMB} MB`);
  console.log(`  Platform: ${targetPlatform}`);
  console.log('\nPackaging successful!');
}
