const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Localizes macOS CFBundleDisplayName to "먹(Meok)" while keeping internal bundle/helper
 * executables pure ASCII ("Meok"), and applies ad-hoc deep codesigning when unsigned.
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const resourcesDir = path.join(appPath, 'Contents', 'Resources');
  const stringsContent = 'CFBundleDisplayName = "먹(Meok)";\n';

  for (const locale of ['ko.lproj', 'en.lproj']) {
    const lprojDir = path.join(resourcesDir, locale);
    await fs.mkdir(lprojDir, { recursive: true });
    await fs.writeFile(path.join(lprojDir, 'InfoPlist.strings'), stringsContent, 'utf8');
  }

  if (!process.env.CSC_LINK) {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
      stdio: 'inherit',
    });
  }
};
