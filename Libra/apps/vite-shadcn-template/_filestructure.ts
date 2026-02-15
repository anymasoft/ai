import * as fs from 'node:fs';
import * as path from 'node:path';

// Export interface definitions
export interface FileInfo {
  type: 'file';
  isBinary: boolean;
  content: string;
}

export interface DirectoryInfo {
  type: 'directory';
  children: Record<string, FileInfo | DirectoryInfo>;
}

export type FileSystemInfo = Record<string, FileInfo | DirectoryInfo>;

// Check if a file is binary
function isBinaryFile(filePath: string): boolean {
  try {
    // Read the first few bytes of the file to check for null bytes
    const buffer = Buffer.alloc(4096);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
    fs.closeSync(fd);
    
    // Check if it contains null bytes (this is a simple binary file detection method)
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking file ${filePath}:`, error);
    return false;
  }
}

// Scan directory and collect file information
function scanDirectory(
  dirPath: string, 
  basePath: string,
  excludePatterns: RegExp[] = [/node_modules/, /\.git/, /\.idea/]
): FileSystemInfo {
  const result: FileSystemInfo = {};
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const relativePath = path.join(basePath, item);
      
      // Check if this item should be excluded
      if (excludePatterns.some(pattern => pattern.test(itemPath))) {
        continue;
      }
      
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        const children = scanDirectory(itemPath, relativePath, excludePatterns);
        if (Object.keys(children).length > 0) {
          result[relativePath] = {
            type: 'directory',
            children
          };
        }
      } else {
        // Check if the file is binary
        const binary = isBinaryFile(itemPath);
        
        let content = '';
        if (!binary) {
          try {
            content = fs.readFileSync(itemPath, 'utf-8');
          } catch (error) {
            console.error(`Error reading file ${itemPath}:`, error);
            content = '/* Unable to read file content */';
          }
        }
        
        result[relativePath] = {
          type: 'file',
          isBinary: binary,
          content: binary ? '/* Binary file content not included */' : content
        };
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
  
  return result;
}

// Main function
export function generateFileStructure(
  rootDir: string, 
  outputPath: string, 
  excludePatterns: RegExp[] = [/node_modules/, /\.git/, /\.idea/]
): void {
  const result = scanDirectory(rootDir, '', excludePatterns);
  
  const fileContent = `export const fileStructure = ${JSON.stringify(result, null, 2)};`;
  
  fs.writeFileSync(outputPath, fileContent, 'utf-8');
}

// If this file is executed directly
if (require.main === module) {
  // Root directory and output file path can be passed as command line arguments
  const rootDir = process.argv[2] || '.';
  const outputPath = process.argv[3] || './fileStructure.ts';
  
  // Default exclude patterns
  const defaultExcludePatterns = [
    /node_modules/, 
    /\.git/, 
    /\.idea/,
    /\.DS_Store/,
    /\.vscode/
  ];
  
  // Additional exclude patterns can be added via environment variable
  const extraExcludeStr = process.env.EXCLUDE_PATTERNS;
  if (extraExcludeStr) {
    const extraPatterns = extraExcludeStr.split(',').map(p => new RegExp(p.trim()));
    generateFileStructure(rootDir, outputPath, [...defaultExcludePatterns, ...extraPatterns]);
  } else {
    generateFileStructure(rootDir, outputPath, defaultExcludePatterns);
  }
}