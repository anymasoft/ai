import { generateFileStructure } from './_filestructure'
/**
 * File structure generation script
 *
 * Usage:
 * 1. Using ts-node: ts-node generate-structure.ts [rootDir] [outputPath]
 * 2. Using bun: bun generate-structure.ts [rootDir] [outputPath]
 *
 * Environment variables:
 * - EXCLUDE_PATTERNS: Comma-separated regular expression strings for excluding files, e.g.:
 *   EXCLUDE_PATTERNS="\.log$,\.tmp$,temp/" ts-node generate-structure.ts
 *
 * Parameters:
 * - rootDir: Root directory to scan (default is current directory ".")
 * - outputPath: Output file path (default is "./fileStructure.ts")
 */

// Get command line arguments
const rootDir = process.argv[2] || '.'
const outputPath = process.argv[3] || './fileStructure.ts'

// Default exclude patterns
const defaultExcludePatterns = [
  /node_modules/,
  /\.git/,
  /\.idea/,
  /\.DS_Store/,
  /\.vscode/,
  /_filestructure\.ts$/,
  /generate-structure\.ts$/,
  /generate\.sh$/,
  /repomix-output\.md$/,
  /repomix\.config\.json$/,
  /bun.lock$/,
  /e2b.toml$/,
  /e2b.Dockerfile$/,
  /.dockerignore$/,
  /inspect.min.js$/,
  /_filestructure.js$/,
  /fileStructure.ts$/,
  /BUILDER-ZH.md$/,
  /BUILDER.md$/,
  /e2b.toml.example$/,
  /\.env.example$/,
  /\.env$/,
]

// Get additional exclude patterns from environment variables
const extraExcludeStr = process.env.EXCLUDE_PATTERNS
if (extraExcludeStr) {
  try {
    const extraPatterns = extraExcludeStr.split(',').map((p) => new RegExp(p.trim()))
    generateFileStructure(rootDir, outputPath, [...defaultExcludePatterns, ...extraPatterns])
  } catch (error) {
    console.error('Error parsing exclude patterns:', error)
    generateFileStructure(rootDir, outputPath, defaultExcludePatterns)
  }
} else {
  // Call generation function
  generateFileStructure(rootDir, outputPath, defaultExcludePatterns)
}
