#!/usr/bin/env node

/**
 * Package VSIX with dependencies
 * 
 * This script automates the VSIX packaging process with proper dependency bundling.
 * It packages the extension without dependencies first, then adds them manually.
 * 
 * Context: pnpm uses symlinks which don't work in VSIX packages when using vsce --dependencies.
 * This script resolves symlinks and bundles actual dependency files into the VSIX.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

const extensionDir = path.resolve(__dirname, '..');
const packageJson = require(path.join(extensionDir, 'package.json'));

const version = packageJson.version;
const vsixName = `nanodex-${version}.vsix`;
const vsixPath = path.join(extensionDir, vsixName);

console.log('Building VSIX package with dependencies...');
console.log(`Package: ${vsixName}`);

// Step 1: Package without dependencies
console.log('\n1. Packaging extension (without dependencies)...');
try {
  execSync('pnpm exec vsce package --no-dependencies', {
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

// Copy each production dependency
const dependencies = packageJson.dependencies || {};
for (const depName of Object.keys(dependencies)) {
  const depSource = path.join(extensionDir, 'node_modules', depName);
  
  if (!fs.existsSync(depSource)) {
    console.error(`Error: Dependency ${depName} not found`);
    process.exit(1);
  }
  
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
        zip.addLocalFile(fullPath, path.dirname(zipEntryPath) || undefined);
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
console.log('\nPackaging successful!');
