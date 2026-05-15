import type { Plugin } from 'vite';

/**
 * Vite plugin to exclude unused @fontsource font files from the build output.
 * 
 * This plugin:
 * 1. Scans the codebase for actual @fontsource imports during transform
 * 2. Filters out unused font files in generateBundle hook
 * 3. Only keeps font files that are actually imported/used
 */
export function excludeUnusedFonts(): Plugin {
  const usedFontFamilies = new Set<string>();
  const fontFilePattern = /\.(woff2?|ttf|otf)$/i;
  // 预编译正则表达式，避免重复创建
  const fontsourceImportRegex = /@fontsource\/([^/\s"']+)/g;
  // 缓存正则表达式，避免重复创建
  const fontFamilyRegexCache = new Map<string, RegExp>();
  // 预编译 @fontsource 模式正则
  const fontsourcePatternRegex = /^[a-z0-9-]+-[a-z0-9-]+-\d+-[a-z0-9-]+-[a-z0-9]+\.(woff2?|ttf|otf)$/i;

  // Helper: Check if asset is a font file
  const isFontAsset = (chunkOrAsset: unknown): boolean =>
    chunkOrAsset !== null &&
    typeof chunkOrAsset === 'object' &&
    'type' in chunkOrAsset &&
    chunkOrAsset.type === 'asset';

  // Helper: Check if font file belongs to a font family (使用缓存)
  const belongsToFontFamily = (fileName: string, fontFamily: string): boolean => {
    let regex = fontFamilyRegexCache.get(fontFamily);
    if (!regex) {
      const normalized = fontFamily.toLowerCase().replace(/-/g, '[-_]?');
      regex = new RegExp(`\\b${normalized}`, 'i');
      fontFamilyRegexCache.set(fontFamily, regex);
    }
    return regex.test(fileName.toLowerCase());
  };

  // Helper: Check if filename matches @fontsource pattern (使用预编译正则)
  const isFontsourcePattern = (fileName: string): boolean => {
    return fontsourcePatternRegex.test(fileName);
  };

  return {
    name: 'exclude-unused-fonts',
    enforce: 'post', // Run after other plugins to catch all imports

    buildStart() {
      usedFontFamilies.clear();
      fontFamilyRegexCache.clear(); // 清理缓存
    },

    transform(code) {
      // Scan for @fontsource imports in both JS/TS and CSS files
      // 使用 lastIndex 重置正则，避免全局正则状态问题
      fontsourceImportRegex.lastIndex = 0;
      let match;
      while ((match = fontsourceImportRegex.exec(code)) !== null) {
        usedFontFamilies.add(match[1]);
      }
      return null;
    },

    generateBundle(options, bundle) {
      const filesToDelete: string[] = [];
      const usedFamiliesArray = Array.from(usedFontFamilies);
      const hasUsedFonts = usedFamiliesArray.length > 0;

      // 优化：先检查是否为字体文件，再检查是否为 @fontsource 模式
      for (const [fileName, chunkOrAsset] of Object.entries(bundle)) {
        // 快速跳过非字体文件
        if (!isFontAsset(chunkOrAsset) || !fontFilePattern.test(fileName)) {
          continue;
        }

        // 快速跳过非 @fontsource 模式的字体文件
        if (!isFontsourcePattern(fileName)) {
          continue;
        }

        // Determine if this font should be deleted
        const shouldDelete = hasUsedFonts
          ? !usedFamiliesArray.some((f) => belongsToFontFamily(fileName, f))
          : true; // No fonts: delete all @fontsource fonts

        if (shouldDelete) {
          filesToDelete.push(fileName);
        }
      }

      // Delete unused font files
      if (filesToDelete.length > 0) {
        for (const fileName of filesToDelete) {
          delete bundle[fileName];
        }
        const message = hasUsedFonts
          ? `Excluded ${filesToDelete.length} unused @fontsource font file(s) from build`
          : `Excluded ${filesToDelete.length} unused @fontsource font file(s) from build (no fonts imported)`;
        this.info(message);
      }
    },
  };
}

