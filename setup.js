/**
 * setup.js — Run this ONCE with: node setup.js
 * Copies xlsx and file-saver from node_modules into libs/
 * Also installs them if not present.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const libsDir = path.join(__dirname, 'libs');
if (!fs.existsSync(libsDir)) fs.mkdirSync(libsDir, { recursive: true });

function tryInstall() {
  console.log('Installing npm packages...');
  try {
    execSync('npm install xlsx file-saver', { stdio: 'inherit', cwd: __dirname });
  } catch (e) {
    console.error('npm install failed:', e.message);
  }
}

function copyLib(src, dest, label) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    const size = fs.statSync(dest).size;
    console.log(`✅ ${label} copied (${(size/1024).toFixed(0)} KB)`);
    return true;
  }
  console.warn(`⚠️  ${label} source not found: ${src}`);
  return false;
}

// XLSX candidates (try multiple paths)
const xlsxCandidates = [
  path.join(__dirname, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js'),
  path.join(__dirname, 'node_modules', 'xlsx', 'dist', 'xlsx.min.js'),
  path.join(__dirname, 'node_modules', 'xlsx', 'xlsx.js'),
];

// FileSaver candidates
const fsCandidates = [
  path.join(__dirname, 'node_modules', 'file-saver', 'dist', 'FileSaver.min.js'),
  path.join(__dirname, 'node_modules', 'file-saver', 'dist', 'FileSaver.js'),
];

function findAndCopy(candidates, dest, label) {
  for (const src of candidates) {
    if (copyLib(src, dest, label)) return true;
  }
  return false;
}

const xlsxDest = path.join(libsDir, 'xlsx.min.js');
const fsDest = path.join(libsDir, 'FileSaver.js');

// Check if already present and valid
const xlsxOk = fs.existsSync(xlsxDest) && fs.statSync(xlsxDest).size > 100000;
const fsOk = fs.existsSync(fsDest) && fs.statSync(fsDest).size > 1000;

if (!xlsxOk || !fsOk) {
  // Try without install first
  let xlsxFound = findAndCopy(xlsxCandidates, xlsxDest, 'xlsx.min.js');
  let fsFound = findAndCopy(fsCandidates, fsDest, 'FileSaver.js');
  
  if (!xlsxFound || !fsFound) {
    tryInstall();
    if (!xlsxFound) findAndCopy(xlsxCandidates, xlsxDest, 'xlsx.min.js');
    if (!fsFound) findAndCopy(fsCandidates, fsDest, 'FileSaver.js');
  }
} else {
  console.log('✅ Libs already present:');
  console.log('   xlsx.min.js:', (fs.statSync(xlsxDest).size/1024).toFixed(0), 'KB');
  console.log('   FileSaver.js:', (fs.statSync(fsDest).size/1024).toFixed(0), 'KB');
}

// Final check
const finalXlsx = fs.existsSync(xlsxDest) ? fs.statSync(xlsxDest).size : 0;
const finalFs = fs.existsSync(fsDest) ? fs.statSync(fsDest).size : 0;

console.log('\n--- Final Status ---');
console.log(finalXlsx > 100000 ? '✅' : '❌', 'xlsx.min.js:', finalXlsx, 'bytes');
console.log(finalFs > 1000 ? '✅' : '❌', 'FileSaver.js:', finalFs, 'bytes');

if (finalXlsx < 100000) {
  console.log('\n❌ xlsx.min.js missing or small! Extension will NOT work.');
  console.log('  Manually download from: https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  console.log('  And save to: libs/xlsx.min.js');
} else {
  console.log('\n🎉 All libs ready! Load the extension in Chrome.');
}
