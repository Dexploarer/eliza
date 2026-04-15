import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  shouldRunIosPodInstall,
  syncPlatformTemplateFiles,
} from "./run-mobile-build.mjs";

const tempDirs: string[] = [];
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appCoreDir = path.resolve(scriptDir, "..");

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "milady-mobile-build-"));
  tempDirs.push(dir);
  return dir;
}

function writeFile(filePath: string, value: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("run-mobile-build", () => {
  it("syncs canonical ios and android platform template files", () => {
    const repoRoot = makeTempDir();
    const appDir = path.join(repoRoot, "apps", "app");

    writeFile(
      path.join(
        repoRoot,
        "eliza",
        "packages",
        "app-core",
        "platforms",
        "ios",
        "App",
        "App.xcodeproj",
        "project.pbxproj",
      ),
      "ios-project\n",
    );
    writeFile(
      path.join(
        repoRoot,
        "eliza",
        "packages",
        "app-core",
        "platforms",
        "ios",
        "App",
        "Podfile",
      ),
      "ios-podfile\n",
    );
    writeFile(
      path.join(
        repoRoot,
        "eliza",
        "packages",
        "app-core",
        "platforms",
        "android",
        "build.gradle",
      ),
      "android-root\n",
    );
    writeFile(
      path.join(
        repoRoot,
        "eliza",
        "packages",
        "app-core",
        "platforms",
        "android",
        "app",
        "capacitor.build.gradle",
      ),
      "android-capacitor\n",
    );
    writeFile(
      path.join(
        repoRoot,
        "eliza",
        "packages",
        "app-core",
        "platforms",
        "android",
        "app",
        "src",
        "main",
        "res",
        "values",
        "strings.xml",
      ),
      "android-strings\n",
    );
    writeFile(
      path.join(
        repoRoot,
        "eliza",
        "packages",
        "app-core",
        "platforms",
        "ios",
        "App",
        "App",
        "App.entitlements",
      ),
      "ios-entitlements\n",
    );
    writeFile(
      path.join(
        repoRoot,
        "eliza",
        "packages",
        "app-core",
        "platforms",
        "ios",
        "App",
        "App",
        "WebsiteBlockerContentExtension",
        "ActionRequestHandler.swift",
      ),
      "ios-action-handler\n",
    );
    writeFile(
      path.join(
        repoRoot,
        "eliza",
        "packages",
        "app-core",
        "platforms",
        "ios",
        "App",
        "App",
        "WebsiteBlockerContentExtension",
        "WebsiteBlockerContentExtension.entitlements",
      ),
      "ios-extension-entitlements\n",
    );

    const iosCopied = syncPlatformTemplateFiles("ios", {
      repoRootValue: repoRoot,
      appDirValue: appDir,
      log: () => {},
    });
    const androidCopied = syncPlatformTemplateFiles("android", {
      repoRootValue: repoRoot,
      appDirValue: appDir,
      log: () => {},
    });

    expect(iosCopied).toEqual([
      path.join("App", "Podfile"),
      path.join("App", "App.xcodeproj", "project.pbxproj"),
      path.join("App", "App", "App.entitlements"),
      path.join(
        "App",
        "App",
        "WebsiteBlockerContentExtension",
        "ActionRequestHandler.swift",
      ),
      path.join(
        "App",
        "App",
        "WebsiteBlockerContentExtension",
        "WebsiteBlockerContentExtension.entitlements",
      ),
    ]);
    expect(androidCopied).toContain("build.gradle");
    expect(androidCopied).toContain(path.join("app", "capacitor.build.gradle"));
    expect(androidCopied).toContain(
      path.join("app", "src", "main", "res", "values", "strings.xml"),
    );
    expect(
      fs.readFileSync(path.join(appDir, "ios", "App", "Podfile"), "utf8"),
    ).toBe("ios-podfile\n");
    expect(
      fs.readFileSync(
        path.join(appDir, "ios", "App", "App.xcodeproj", "project.pbxproj"),
        "utf8",
      ),
    ).toBe("ios-project\n");
    expect(
      fs.readFileSync(path.join(appDir, "android", "build.gradle"), "utf8"),
    ).toBe("android-root\n");
    expect(
      fs.readFileSync(
        path.join(appDir, "android", "app", "capacitor.build.gradle"),
        "utf8",
      ),
    ).toBe("android-capacitor\n");
    expect(
      fs.readFileSync(
        path.join(
          appDir,
          "android",
          "app",
          "src",
          "main",
          "res",
          "values",
          "strings.xml",
        ),
        "utf8",
      ),
    ).toBe("android-strings\n");
    expect(
      fs.readFileSync(
        path.join(appDir, "ios", "App", "App", "App.entitlements"),
        "utf8",
      ),
    ).toBe("ios-entitlements\n");
    expect(
      fs.readFileSync(
        path.join(
          appDir,
          "ios",
          "App",
          "App",
          "WebsiteBlockerContentExtension",
          "ActionRequestHandler.swift",
        ),
        "utf8",
      ),
    ).toBe("ios-action-handler\n");
    expect(
      fs.readFileSync(
        path.join(
          appDir,
          "ios",
          "App",
          "App",
          "WebsiteBlockerContentExtension",
          "WebsiteBlockerContentExtension.entitlements",
        ),
        "utf8",
      ),
    ).toBe("ios-extension-entitlements\n");
  });

  it("keeps synced mobile templates portable and aligned with the active plugin set", () => {
    const androidSettings = fs.readFileSync(
      path.join(
        appCoreDir,
        "platforms",
        "android",
        "capacitor.settings.gradle",
      ),
      "utf8",
    );
    const androidBuild = fs.readFileSync(
      path.join(
        appCoreDir,
        "platforms",
        "android",
        "app",
        "capacitor.build.gradle",
      ),
      "utf8",
    );
    const iosPodfile = fs.readFileSync(
      path.join(appCoreDir, "platforms", "ios", "App", "Podfile"),
      "utf8",
    );

    expect(androidSettings).not.toContain("node_modules/.bun/");
    expect(androidSettings).toContain(
      "project(':capacitor-android').projectDir = new File('../node_modules/@capacitor/android/capacitor')",
    );
    expect(androidSettings).not.toContain("capacitor-status-bar");

    expect(androidBuild).not.toContain(
      "implementation project(':capacitor-status-bar')",
    );

    expect(iosPodfile).not.toContain("node_modules/.bun/");
    expect(iosPodfile).toContain(
      "require_relative '../../node_modules/@capacitor/ios/scripts/pods_helpers'",
    );
    expect(iosPodfile).not.toContain("CapacitorStatusBar");
  });

  it("forces CocoaPods refreshes when the synced files include the iOS Podfile", () => {
    expect(shouldRunIosPodInstall([path.join("App", "Podfile")])).toBe(true);
    expect(shouldRunIosPodInstall(["build.gradle"])).toBe(false);
  });

  it("keeps canonical mobile bundle identifiers aligned with Milady", () => {
    const iosProject = fs.readFileSync(
      path.join(
        appCoreDir,
        "platforms",
        "ios",
        "App",
        "App.xcodeproj",
        "project.pbxproj",
      ),
      "utf8",
    );
    const iosEntitlements = fs.readFileSync(
      path.join(
        appCoreDir,
        "platforms",
        "ios",
        "App",
        "App",
        "App.entitlements",
      ),
      "utf8",
    );
    const iosExtensionEntitlements = fs.readFileSync(
      path.join(
        appCoreDir,
        "platforms",
        "ios",
        "App",
        "App",
        "WebsiteBlockerContentExtension",
        "WebsiteBlockerContentExtension.entitlements",
      ),
      "utf8",
    );
    const actionRequestHandler = fs.readFileSync(
      path.join(
        appCoreDir,
        "platforms",
        "ios",
        "App",
        "App",
        "WebsiteBlockerContentExtension",
        "ActionRequestHandler.swift",
      ),
      "utf8",
    );
    const androidBuild = fs.readFileSync(
      path.join(appCoreDir, "platforms", "android", "app", "build.gradle"),
      "utf8",
    );
    const androidStrings = fs.readFileSync(
      path.join(
        appCoreDir,
        "platforms",
        "android",
        "app",
        "src",
        "main",
        "res",
        "values",
        "strings.xml",
      ),
      "utf8",
    );

    expect(iosProject).toContain(
      "PRODUCT_BUNDLE_IDENTIFIER = com.miladyai.milady;",
    );
    expect(iosProject).toContain(
      "PRODUCT_BUNDLE_IDENTIFIER = com.miladyai.milady.WebsiteBlockerContentExtension;",
    );
    expect(iosEntitlements).toContain("group.com.miladyai.milady");
    expect(iosExtensionEntitlements).toContain("group.com.miladyai.milady");
    expect(actionRequestHandler).toContain(
      'static let appGroupIdentifier = "group.com.miladyai.milady"',
    );
    expect(androidBuild).toContain('applicationId "com.miladyai.milady"');
    expect(androidStrings).toContain(
      '<string name="package_name">com.miladyai.milady</string>',
    );
    expect(androidStrings).toContain(
      '<string name="custom_url_scheme">milady</string>',
    );
  });
});
