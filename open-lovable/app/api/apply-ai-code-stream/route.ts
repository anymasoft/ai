import { NextRequest, NextResponse } from 'next/server';
// Morph Fast Apply is completely disabled for MVP - using full file rewrites instead
// import { parseMorphEdits, applyMorphEditToFile } from '@/lib/morph-fast-apply';
// Sandbox import not needed - using global sandbox from sandbox-manager
import type { SandboxState } from '@/types/sandbox';
import type { ConversationState } from '@/types/conversation';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { localSandboxManager } from '@/lib/sandbox/local-sandbox-manager';

// MVP: Force full file rewrites for all edits - Morph Fast Apply disabled
const FORCE_FULL_REWRITE_FOR_EDITS = true;

declare global {
  var conversationState: ConversationState | null;
  var activeSandboxProvider: any;
  var existingFiles: Set<string>;
  var sandboxState: SandboxState;
}

interface ParsedResponse {
  explanation: string;
  template: string;
  files: Array<{ path: string; content: string }>;
  packages: string[];
  commands: string[];
  structure: string | null;
}

function parseAIResponse(response: string): ParsedResponse {
  const sections = {
    files: [] as Array<{ path: string; content: string }>,
    commands: [] as string[],
    packages: [] as string[],
    structure: null as string | null,
    explanation: '',
    template: ''
  };

  // Function to extract packages from import statements
  function extractPackagesFromCode(content: string): string[] {
    const packages: string[] = [];
    // Match ES6 imports
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
    let importMatch;

    while ((importMatch = importRegex.exec(content)) !== null) {
      const importPath = importMatch[1];
      // Skip relative imports and built-in React
      if (!importPath.startsWith('.') && !importPath.startsWith('/') &&
        importPath !== 'react' && importPath !== 'react-dom' &&
        !importPath.startsWith('@/')) {
        // Extract package name (handle scoped packages like @heroicons/react)
        const packageName = importPath.startsWith('@')
          ? importPath.split('/').slice(0, 2).join('/')
          : importPath.split('/')[0];

        if (!packages.includes(packageName)) {
          packages.push(packageName);

          // Log important packages for debugging
          if (packageName === 'react-router-dom' || packageName.includes('router') || packageName.includes('icon')) {
            console.log(`[apply-ai-code-stream] Detected package from imports: ${packageName}`);
          }
        }
      }
    }

    return packages;
  }

  // Parse file sections - handle duplicates and prefer complete versions
  const fileMap = new Map<string, { content: string; isComplete: boolean }>();

  // First pass: Find all file declarations
  const fileRegex = /<file path="([^"]+)">([\s\S]*?)(?:<\/file>|$)/g;
  let match;
  while ((match = fileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const content = match[2].trim();
    const hasClosingTag = response.substring(match.index, match.index + match[0].length).includes('</file>');

    // Check if this file already exists in our map
    const existing = fileMap.get(filePath);

    // Decide whether to keep this version
    let shouldReplace = false;
    if (!existing) {
      shouldReplace = true; // First occurrence
    } else if (!existing.isComplete && hasClosingTag) {
      shouldReplace = true; // Replace incomplete with complete
      console.log(`[apply-ai-code-stream] Replacing incomplete ${filePath} with complete version`);
    } else if (existing.isComplete && hasClosingTag && content.length > existing.content.length) {
      shouldReplace = true; // Replace with longer complete version
      console.log(`[apply-ai-code-stream] Replacing ${filePath} with longer complete version`);
    } else if (!existing.isComplete && !hasClosingTag && content.length > existing.content.length) {
      shouldReplace = true; // Both incomplete, keep longer one
    }

    if (shouldReplace) {
      // Additional validation: reject obviously broken content
      if (content.includes('...') && !content.includes('...props') && !content.includes('...rest')) {
        console.warn(`[apply-ai-code-stream] Warning: ${filePath} contains ellipsis, may be truncated`);
        // Still use it if it's the only version we have
        if (!existing) {
          fileMap.set(filePath, { content, isComplete: hasClosingTag });
        }
      } else {
        fileMap.set(filePath, { content, isComplete: hasClosingTag });
      }
    }
  }

  // Convert map to array for sections.files
  for (const [path, { content, isComplete }] of fileMap.entries()) {
    if (!isComplete) {
      console.log(`[apply-ai-code-stream] Warning: File ${path} appears to be truncated (no closing tag)`);
    }

    sections.files.push({
      path,
      content
    });

    // Extract packages from file content
    const filePackages = extractPackagesFromCode(content);
    for (const pkg of filePackages) {
      if (!sections.packages.includes(pkg)) {
        sections.packages.push(pkg);
        console.log(`[apply-ai-code-stream] 📦 Package detected from imports: ${pkg}`);
      }
    }
  }

  // Also parse markdown code blocks with file paths
  const markdownFileRegex = /```(?:file )?path="([^"]+)"\n([\s\S]*?)```/g;
  while ((match = markdownFileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const content = match[2].trim();
    sections.files.push({
      path: filePath,
      content: content
    });

    // Extract packages from file content
    const filePackages = extractPackagesFromCode(content);
    for (const pkg of filePackages) {
      if (!sections.packages.includes(pkg)) {
        sections.packages.push(pkg);
        console.log(`[apply-ai-code-stream] 📦 Package detected from imports: ${pkg}`);
      }
    }
  }

  // Parse plain text format like "Generated Files: Header.jsx, index.css"
  const generatedFilesMatch = response.match(/Generated Files?:\s*([^\n]+)/i);
  if (generatedFilesMatch) {
    // Split by comma first, then trim whitespace, to preserve filenames with dots
    const filesList = generatedFilesMatch[1]
      .split(',')
      .map(f => f.trim())
      .filter(f => f.endsWith('.jsx') || f.endsWith('.js') || f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css') || f.endsWith('.json') || f.endsWith('.html'));
    console.log(`[apply-ai-code-stream] Detected generated files from plain text: ${filesList.join(', ')}`);

    // Try to extract the actual file content if it follows
    for (const fileName of filesList) {
      // Look for the file content after the file name
      const fileContentRegex = new RegExp(`${fileName}[\\s\\S]*?(?:import[\\s\\S]+?)(?=Generated Files:|Applying code|$)`, 'i');
      const fileContentMatch = response.match(fileContentRegex);
      if (fileContentMatch) {
        // Extract just the code part (starting from import statements)
        const codeMatch = fileContentMatch[0].match(/^(import[\s\S]+)$/m);
        if (codeMatch) {
          const filePath = fileName.includes('/') ? fileName : `src/components/${fileName}`;
          sections.files.push({
            path: filePath,
            content: codeMatch[1].trim()
          });
          console.log(`[apply-ai-code-stream] Extracted content for ${filePath}`);

          // Extract packages from this file
          const filePackages = extractPackagesFromCode(codeMatch[1]);
          for (const pkg of filePackages) {
            if (!sections.packages.includes(pkg)) {
              sections.packages.push(pkg);
              console.log(`[apply-ai-code-stream] Package detected from imports: ${pkg}`);
            }
          }
        }
      }
    }
  }

  // Also try to parse if the response contains raw JSX/JS code blocks
  const codeBlockRegex = /```(?:jsx?|tsx?|javascript|typescript)?\n([\s\S]*?)```/g;
  while ((match = codeBlockRegex.exec(response)) !== null) {
    const content = match[1].trim();
    // Try to detect the file name from comments or context
    const fileNameMatch = content.match(/\/\/\s*(?:File:|Component:)\s*([^\n]+)/);
    if (fileNameMatch) {
      const fileName = fileNameMatch[1].trim();
      const filePath = fileName.includes('/') ? fileName : `src/components/${fileName}`;

      // Don't add duplicate files
      if (!sections.files.some(f => f.path === filePath)) {
        sections.files.push({
          path: filePath,
          content: content
        });

        // Extract packages
        const filePackages = extractPackagesFromCode(content);
        for (const pkg of filePackages) {
          if (!sections.packages.includes(pkg)) {
            sections.packages.push(pkg);
          }
        }
      }
    }
  }

  // Parse commands
  const cmdRegex = /<command>(.*?)<\/command>/g;
  while ((match = cmdRegex.exec(response)) !== null) {
    sections.commands.push(match[1].trim());
  }

  // Parse packages - support both <package> and <packages> tags
  const pkgRegex = /<package>(.*?)<\/package>/g;
  while ((match = pkgRegex.exec(response)) !== null) {
    sections.packages.push(match[1].trim());
  }

  // Also parse <packages> tag with multiple packages
  const packagesRegex = /<packages>([\s\S]*?)<\/packages>/;
  const packagesMatch = response.match(packagesRegex);
  if (packagesMatch) {
    const packagesContent = packagesMatch[1].trim();
    // Split by newlines or commas
    const packagesList = packagesContent.split(/[\n,]+/)
      .map(pkg => pkg.trim())
      .filter(pkg => pkg.length > 0);
    sections.packages.push(...packagesList);
  }

  // Parse structure
  const structureMatch = /<structure>([\s\S]*?)<\/structure>/;
  const structResult = response.match(structureMatch);
  if (structResult) {
    sections.structure = structResult[1].trim();
  }

  // Parse explanation
  const explanationMatch = /<explanation>([\s\S]*?)<\/explanation>/;
  const explResult = response.match(explanationMatch);
  if (explResult) {
    sections.explanation = explResult[1].trim();
  }

  // Parse template
  const templateMatch = /<template>(.*?)<\/template>/;
  const templResult = response.match(templateMatch);
  if (templResult) {
    sections.template = templResult[1].trim();
  }

  return sections;
}

/**
 * Parse edit response to extract <edit target_file="..."><update>...</update></edit> blocks
 * Returns array of { targetFile, fullContent } for atomic file rewrites
 */
function parseEditResponse(response: string): Array<{ targetFile: string; fullContent: string }> {
  const edits: Array<{ targetFile: string; fullContent: string }> = [];

  // Match <edit target_file="...">...<update>...</update></edit> blocks
  const editRegex = /<edit\s+target_file="([^"]+)">([\s\S]*?)<\/edit>/g;
  let match;

  while ((match = editRegex.exec(response)) !== null) {
    const targetFile = match[1];
    const editContent = match[2];

    // Security: Prevent path traversal
    if (targetFile.includes('..') || targetFile.startsWith('/')) {
      console.warn(`[EDIT_REWRITE] Rejecting dangerous path: ${targetFile}`);
      continue;
    }

    // Extract the <update> block content (full file content)
    const updateMatch = /<update>([\s\S]*?)<\/update>/.exec(editContent);
    if (!updateMatch) {
      console.warn(`[EDIT_REWRITE] No <update> block found for ${targetFile}`);
      continue;
    }

    const fullContent = updateMatch[1].trim();

    // Validate: Reject diff/patch format (no +/- at line start)
    const lines = fullContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trimStart();
      if ((trimmed.startsWith('+') || trimmed.startsWith('-')) &&
          !trimmed.startsWith('+++') && !trimmed.startsWith('---') &&
          // Allow +/- in normal code (e.g., ++ operators, mathematical expressions)
          trimmed.match(/^[\+\-]\s/) &&
          lines.length > 1) {
        console.warn(`[EDIT_REWRITE] Possible diff/patch format detected in ${targetFile}, may not be full file`);
        // Continue anyway - might be valid code with +/- operators
      }
    }

    // Reject obviously truncated content
    if (fullContent.endsWith('...') || fullContent.endsWith('...}')) {
      console.warn(`[EDIT_REWRITE] Content appears truncated for ${targetFile}`);
      continue;
    }

    edits.push({ targetFile, fullContent });
    console.log(`[EDIT_REWRITE] Parsed edit for: ${targetFile} (${fullContent.length} chars)`);
  }

  return edits;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[TRACE] apply start');
    const { response, isEdit = false, packages = [], sandboxId } = await request.json();

    if (!response) {
      return NextResponse.json({
        error: 'response is required'
      }, { status: 400 });
    }

    // Debug log the response
    console.log('[apply-ai-code-stream] Received response to parse:');
    console.log('[apply-ai-code-stream] Response length:', response.length);
    console.log('[apply-ai-code-stream] Response preview:', response.substring(0, 500));
    console.log('[apply-ai-code-stream] isEdit:', isEdit);
    console.log('[apply-ai-code-stream] packages:', packages);
    console.log('[apply-ai-code-stream] sandboxId:', sandboxId);

    // CRITICAL: sandboxId MUST be provided
    // Do NOT create a new sandbox - apply code to existing sandbox only
    if (!sandboxId) {
      console.error('[apply-ai-code-stream] ERROR: sandboxId is required. Call /api/create-ai-sandbox-v2 first.');
      return NextResponse.json({
        error: 'sandboxId is required. Please create a sandbox first by calling /api/create-ai-sandbox-v2'
      }, { status: 400 });
    }

    console.log('[apply-ai-code-stream] Using sandbox:', sandboxId);

    // Parse the AI response
    const parsed = parseAIResponse(response);
    // MVP: Morph Fast Apply is completely disabled - all edits use full file rewrites
    const morphEnabled = false;
    const morphEdits: any[] = [];
    console.log('[EDIT_REWRITE] Morph Fast Apply disabled - using full file rewrites for MVP');
    
    // Log what was parsed
    console.log('[apply-ai-code-stream] Parsed result:');
    console.log('[apply-ai-code-stream] Files found:', parsed.files.length);
    if (parsed.files.length > 0) {
      parsed.files.forEach(f => {
        console.log(`[apply-ai-code-stream] - ${f.path} (${f.content.length} chars)`);
      });
    }
    console.log('[apply-ai-code-stream] Packages found:', parsed.packages);

    // Initialize existingFiles if not already
    if (!global.existingFiles) {
      global.existingFiles = new Set<string>();
    }

    // Get provider for the sandbox
    // sandboxId is guaranteed to exist at this point (checked above)
    const provider = sandboxManager.getProvider(sandboxId);

    if (!provider) {
      console.error(`[apply-ai-code-stream] ERROR: Sandbox not found: ${sandboxId}. Session may have expired.`);
      return NextResponse.json({
        error: `Sandbox not found: ${sandboxId}. Please create a new sandbox by calling /api/create-ai-sandbox-v2`
      }, { status: 404 });
    }

    console.log(`[apply-ai-code-stream] Found provider for sandbox: ${sandboxId}`);

    // Create a response stream for real-time updates
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Function to send progress updates
    const sendProgress = async (data: any) => {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    };

    // Start processing in background
    (async (providerInstance, req) => {
      // No sandbox replacement logic needed - apply always uses existing sandbox

      const results = {
        filesCreated: [] as string[],
        filesUpdated: [] as string[],
        packagesInstalled: [] as string[],
        packagesAlreadyInstalled: [] as string[],
        packagesFailed: [] as string[],
        commandsExecuted: [] as string[],
        errors: [] as string[]
      };

      try {
        await sendProgress({
          type: 'start',
          message: 'Starting code application...',
          totalSteps: 3
        });
        // EDIT MODE: Handle file edits with atomic writes (no package install, no commands)
        if (isEdit && FORCE_FULL_REWRITE_FOR_EDITS) {
          console.log('[EDIT_REWRITE] Processing edit mode with full file rewrites');
          await sendProgress({
            type: 'info',
            message: 'Edit mode: Applying full file rewrites...'
          });

          // Parse edit response to get targetFile and fullContent
          const edits = parseEditResponse(response);
          console.log(`[EDIT_REWRITE] Found ${edits.length} edits to apply`);

          if (edits.length === 0) {
            await sendProgress({
              type: 'warning',
              message: 'No valid edits found in response'
            });
            results.errors.push('No valid edits found in response');
          } else {
            // Get sandbox directory for direct file writes
            const sandboxDir = localSandboxManager.getSandbox(sandboxId)?.dir;
            if (!sandboxDir) {
              const errMsg = `[EDIT_REWRITE] Sandbox directory not found for ${sandboxId}`;
              console.error(errMsg);
              await sendProgress({ type: 'error', message: errMsg });
              results.errors.push(errMsg);
            } else {
              const fs = require('fs');
              const path = require('path');

              // Process each edit atomically
              for (const [idx, edit] of edits.entries()) {
                try {
                  await sendProgress({
                    type: 'file-progress',
                    current: idx + 1,
                    total: edits.length,
                    fileName: edit.targetFile,
                    action: 'editing'
                  });

                  // Normalize path (already validated in parseEditResponse)
                  let filePath = edit.targetFile;
                  if (filePath.startsWith('/')) filePath = filePath.substring(1);

                  // Add src/ prefix if needed
                  if (!filePath.startsWith('src/') && !filePath.startsWith('public/') &&
                      filePath !== 'index.html' && !filePath.match(/\.(json|js|config)$/i)) {
                    filePath = 'src/' + filePath;
                  }

                  const fullPath = path.join(sandboxDir, filePath);
                  const fileDir = path.dirname(fullPath);

                  // Ensure directory exists
                  fs.mkdirSync(fileDir, { recursive: true });

                  // Write file atomically
                  fs.writeFileSync(fullPath, edit.fullContent, 'utf-8');
                  const bytesWritten = edit.fullContent.length;

                  console.log('[EDIT_REWRITE] File written:', {
                    filePath,
                    fullPath,
                    bytesWritten,
                    preview: edit.fullContent.substring(0, 100).replace(/\n/g, '\\n')
                  });

                  results.filesUpdated.push(filePath);
                  if (global.existingFiles) global.existingFiles.add(filePath);

                  // Update file cache if available
                  if (global.sandboxState?.fileCache) {
                    global.sandboxState.fileCache.files[filePath] = {
                      content: edit.fullContent,
                      lastModified: Date.now()
                    };
                  }

                  await sendProgress({
                    type: 'file-complete',
                    fileName: filePath,
                    action: 'edited'
                  });
                } catch (err) {
                  const errMsg = (err as Error).message;
                  console.error('[EDIT_REWRITE] Edit failed for', edit.targetFile, errMsg);
                  results.errors.push(`Edit failed for ${edit.targetFile}: ${errMsg}`);
                  await sendProgress({
                    type: 'file-error',
                    fileName: edit.targetFile,
                    error: errMsg
                  });
                }
              }
            }
          }

          // Verification for edits: read back and confirm
          const sandboxDirForVerify = localSandboxManager.getSandbox(sandboxId)?.dir;
          if (sandboxDirForVerify && edits.length > 0) {
            const fs = require('fs');
            const path = require('path');
            console.log('[EDIT_REWRITE] VERIFICATION - reading back edited files');

            for (const edit of edits) {
              try {
                let filePath = edit.targetFile;
                if (filePath.startsWith('/')) filePath = filePath.substring(1);
                if (!filePath.startsWith('src/') && !filePath.startsWith('public/') &&
                    filePath !== 'index.html' && !filePath.match(/\.(json|js|config)$/i)) {
                  filePath = 'src/' + filePath;
                }

                const fullPath = path.join(sandboxDirForVerify, filePath);
                if (fs.existsSync(fullPath)) {
                  const readContent = fs.readFileSync(fullPath, 'utf-8');
                  console.log('[EDIT_REWRITE] VERIFIED:', {
                    filePath,
                    exists: true,
                    size: readContent.length,
                    preview: readContent.substring(0, 100).replace(/\n/g, '\\n')
                  });
                } else {
                  console.warn('[EDIT_REWRITE] VERIFICATION FAILED - file not found:', fullPath);
                }
              } catch (e) {
                console.error('[EDIT_REWRITE] VERIFICATION ERROR:', (e as Error).message);
              }
            }
          }

          await sendProgress({
            type: 'complete',
            filesUpdated: results.filesUpdated,
            errors: results.errors,
            message: 'Edit complete'
          });

          // Close the stream
          await writer.close();
          return;
        }

        // GENERATE MODE: Install packages and create/update files
        // Step 1: Install packages
        const packagesArray = Array.isArray(packages) ? packages : [];
        const parsedPackages = Array.isArray(parsed.packages) ? parsed.packages : [];

        // Combine and deduplicate packages
        const allPackages = [...packagesArray.filter(pkg => pkg && typeof pkg === 'string'), ...parsedPackages];

        // Use Set to remove duplicates, then filter out pre-installed packages
        const uniquePackages = [...new Set(allPackages)]
          .filter(pkg => pkg && typeof pkg === 'string' && pkg.trim() !== '') // Remove empty strings
          .filter(pkg => pkg !== 'react' && pkg !== 'react-dom'); // Filter pre-installed

        // Log if we found duplicates
        if (allPackages.length !== uniquePackages.length) {
          console.log(`[apply-ai-code-stream] Removed ${allPackages.length - uniquePackages.length} duplicate packages`);
          console.log(`[apply-ai-code-stream] Original packages:`, allPackages);
          console.log(`[apply-ai-code-stream] Deduplicated packages:`, uniquePackages);
        }

        if (uniquePackages.length > 0) {
          await sendProgress({
            type: 'step',
            step: 1,
            message: `Installing ${uniquePackages.length} packages...`,
            packages: uniquePackages
          });

          // Use streaming package installation
          try {
            // Construct the API URL properly for both dev and production
            const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
            const host = req.headers.get('host') || 'localhost:3000';
            const apiUrl = `${protocol}://${host}/api/install-packages`;

            const installResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                packages: uniquePackages,
                sandboxId: sandboxId || providerInstance.getSandboxInfo()?.sandboxId
              })
            });

            if (installResponse.ok && installResponse.body) {
              const reader = installResponse.body.getReader();
              const decoder = new TextDecoder();

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                if (!chunk) continue;
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.slice(6));

                      // Forward package installation progress
                      await sendProgress({
                        type: 'package-progress',
                        ...data
                      });

                      // Track results
                      if (data.type === 'success' && data.installedPackages) {
                        results.packagesInstalled = data.installedPackages;
                      }
                    } catch (parseError) {
                      console.debug('Error parsing terminal output:', parseError);
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('[apply-ai-code-stream] Error installing packages:', error);
            await sendProgress({
              type: 'warning',
              message: `Package installation skipped (${(error as Error).message}). Continuing with file creation...`
            });
            results.errors.push(`Package installation failed: ${(error as Error).message}`);
          }
        } else {
          await sendProgress({
            type: 'step',
            step: 1,
            message: 'No additional packages to install, skipping...'
          });
        }

        // Step 2: Create/update files
        const filesArray = Array.isArray(parsed.files) ? parsed.files : [];
        await sendProgress({
          type: 'step',
          step: 2,
          message: `Creating ${filesArray.length} files...`
        });

        // Filter out config files that shouldn't be created
        const configFiles = ['tailwind.config.js', 'vite.config.js', 'package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.js'];
        let filteredFiles = filesArray.filter(file => {
          if (!file || typeof file !== 'object') return false;
          const fileName = (file.path || '').split('/').pop() || '';
          return !configFiles.includes(fileName);
        });

        // If Morph is enabled and we have edits, apply them before file writes
        const morphUpdatedPaths = new Set<string>();
        if (morphEnabled && morphEdits.length > 0) {
          const morphSandbox = (global as any).activeSandbox || providerInstance;
          if (!morphSandbox) {
            console.warn('[apply-ai-code-stream] No sandbox available to apply Morph edits');
            await sendProgress({ type: 'warning', message: 'No sandbox available to apply Morph edits' });
          } else {
            await sendProgress({ type: 'info', message: `Applying ${morphEdits.length} fast edits via Morph...` });
            for (const [idx, edit] of morphEdits.entries()) {
              try {
                await sendProgress({ type: 'file-progress', current: idx + 1, total: morphEdits.length, fileName: edit.targetFile, action: 'morph-applying' });
                const result = await applyMorphEditToFile({
                  sandbox: morphSandbox,
                  targetPath: edit.targetFile,
                  instructions: edit.instructions,
                  updateSnippet: edit.update
                });
                if (result.success && result.normalizedPath) {
                  console.log('[apply-ai-code-stream] Morph updated', result.normalizedPath);
                  morphUpdatedPaths.add(result.normalizedPath);
                  if (results.filesUpdated) results.filesUpdated.push(result.normalizedPath);
                  await sendProgress({ type: 'file-complete', fileName: result.normalizedPath, action: 'morph-updated' });
                } else {
                  const msg = result.error || 'Unknown Morph error';
                  console.error('[apply-ai-code-stream] Morph apply failed for', edit.targetFile, msg);
                  if (results.errors) results.errors.push(`Morph apply failed for ${edit.targetFile}: ${msg}`);
                  await sendProgress({ type: 'file-error', fileName: edit.targetFile, error: msg });
                }
              } catch (err) {
                const msg = (err as Error).message;
                console.error('[apply-ai-code-stream] Morph apply exception for', edit.targetFile, msg);
                if (results.errors) results.errors.push(`Morph apply exception for ${edit.targetFile}: ${msg}`);
                await sendProgress({ type: 'file-error', fileName: edit.targetFile, error: msg });
              }
            }
          }
        }

        // Avoid overwriting Morph-updated files in the file write loop
        if (morphUpdatedPaths.size > 0) {
          filteredFiles = filteredFiles.filter(file => {
            if (!file?.path) return true;
            let normalizedPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
            const fileName = normalizedPath.split('/').pop() || '';
            if (!normalizedPath.startsWith('src/') &&
                !normalizedPath.startsWith('public/') &&
                normalizedPath !== 'index.html' &&
                !configFiles.includes(fileName)) {
              normalizedPath = 'src/' + normalizedPath;
            }
            return !morphUpdatedPaths.has(normalizedPath);
          });
        }
        
        for (const [index, file] of filteredFiles.entries()) {
          try {
            // Send progress for each file
            await sendProgress({
              type: 'file-progress',
              current: index + 1,
              total: filteredFiles.length,
              fileName: file.path,
              action: 'creating'
            });

            // Normalize the file path
            let normalizedPath = file.path;
            if (normalizedPath.startsWith('/')) {
              normalizedPath = normalizedPath.substring(1);
            }
            if (!normalizedPath.startsWith('src/') &&
              !normalizedPath.startsWith('public/') &&
              normalizedPath !== 'index.html' &&
              !configFiles.includes(normalizedPath.split('/').pop() || '')) {
              normalizedPath = 'src/' + normalizedPath;
            }

            const isUpdate = global.existingFiles.has(normalizedPath);

            // Remove any CSS imports from JSX/JS files (we're using Tailwind)
            let fileContent = file.content;
            if (file.path.endsWith('.jsx') || file.path.endsWith('.js') || file.path.endsWith('.tsx') || file.path.endsWith('.ts')) {
              fileContent = fileContent.replace(/import\s+['"]\.\/[^'"]+\.css['"];?\s*\n?/g, '');
            }

            // Fix common Tailwind CSS errors in CSS files
            if (file.path.endsWith('.css')) {
              // Replace shadow-3xl with shadow-2xl (shadow-3xl doesn't exist)
              fileContent = fileContent.replace(/shadow-3xl/g, 'shadow-2xl');
              // Replace any other non-existent shadow utilities
              fileContent = fileContent.replace(/shadow-4xl/g, 'shadow-2xl');
              fileContent = fileContent.replace(/shadow-5xl/g, 'shadow-2xl');
            }

            // Write the file using provider
            await providerInstance.writeFile(normalizedPath, fileContent);

            // DIAGNOSTIC: Log what was written
            const sandboxDirForDiag = localSandboxManager.getSandbox(sandboxId)?.dir;
            console.log(`[apply-ai-code-stream] File written:`, {
              normalizedPath,
              sandboxId,
              sandboxDir: sandboxDirForDiag,
              fileSize: fileContent.length,
              isUpdate,
              isFirstChars: fileContent.substring(0, 80).replace(/\n/g, '\\n')
            });

            // Update file cache
            if (global.sandboxState?.fileCache) {
              global.sandboxState.fileCache.files[normalizedPath] = {
                content: fileContent,
                lastModified: Date.now()
              };
            }

            if (isUpdate) {
              if (results.filesUpdated) results.filesUpdated.push(normalizedPath);
            } else {
              if (results.filesCreated) results.filesCreated.push(normalizedPath);
              if (global.existingFiles) global.existingFiles.add(normalizedPath);
            }

            await sendProgress({
              type: 'file-complete',
              fileName: normalizedPath,
              action: isUpdate ? 'updated' : 'created'
            });
          } catch (error) {
            if (results.errors) {
              results.errors.push(`Failed to create ${file.path}: ${(error as Error).message}`);
            }
            await sendProgress({
              type: 'file-error',
              fileName: file.path,
              error: (error as Error).message
            });
          }
        }

        // VERIFICATION: Ensure all files are actually written to sandbox
        console.log('[apply-ai-code-stream] VERIFICATION PHASE - checking files on disk');
        const sandboxDir = localSandboxManager.getSandbox(sandboxId)?.dir;
        if (sandboxDir && Array.isArray(parsed.files)) {
          const fs = require('fs');
          const path = require('path');

          // Write ALL files without filtering
          for (const file of parsed.files) {
            if (!file || !file.path || !file.content) continue;

            // Normalize path
            let filePath = file.path;
            if (filePath.startsWith('/')) filePath = filePath.substring(1);

            // Create full path
            const fullPath = path.join(sandboxDir, filePath);
            const fileDir = path.dirname(fullPath);

            try {
              // Create directory if needed
              fs.mkdirSync(fileDir, { recursive: true });
              // Write file
              fs.writeFileSync(fullPath, file.content, 'utf-8');

              console.log('[apply-ai-code-stream] VERIFIED WRITE:', {
                filePath,
                fullPath,
                size: file.content.length,
                first100: file.content.substring(0, 100).replace(/\n/g, '\\n')
              });
            } catch (e) {
              console.error('[apply-ai-code-stream] VERIFICATION WRITE FAILED:', filePath, (e as Error).message);
            }
          }

          // IMMEDIATE CHECK: Read back what we just wrote
          console.log('[apply-ai-code-stream] FINAL CHECK - reading files back');
          try {
            const appJsxPath = path.join(sandboxDir, 'src/App.jsx');
            if (fs.existsSync(appJsxPath)) {
              const content = fs.readFileSync(appJsxPath, 'utf-8');
              console.log('[apply-ai-code-stream] READBACK App.jsx:', {
                exists: true,
                size: content.length,
                first200: content.substring(0, 200).replace(/\n/g, '\\n')
              });
            } else {
              console.warn('[apply-ai-code-stream] READBACK App.jsx NOT FOUND at:', appJsxPath);
            }
          } catch (e) {
            console.error('[apply-ai-code-stream] READBACK FAILED:', (e as Error).message);
          }
        }

        // Step 3: Execute commands
        const commandsArray = Array.isArray(parsed.commands) ? parsed.commands : [];
        if (commandsArray.length > 0) {
          await sendProgress({
            type: 'step',
            step: 3,
            message: `Executing ${commandsArray.length} commands...`
          });

          for (const [index, cmd] of commandsArray.entries()) {
            try {
              await sendProgress({
                type: 'command-progress',
                current: index + 1,
                total: parsed.commands.length,
                command: cmd,
                action: 'executing'
              });

              // Use provider runCommand
              const result = await providerInstance.runCommand(cmd);

              // Get command output from provider result
              const stdout = result.stdout;
              const stderr = result.stderr;

              if (stdout) {
                await sendProgress({
                  type: 'command-output',
                  command: cmd,
                  output: stdout,
                  stream: 'stdout'
                });
              }

              if (stderr) {
                await sendProgress({
                  type: 'command-output',
                  command: cmd,
                  output: stderr,
                  stream: 'stderr'
                });
              }

              if (results.commandsExecuted) {
                results.commandsExecuted.push(cmd);
              }

              await sendProgress({
                type: 'command-complete',
                command: cmd,
                exitCode: result.exitCode,
                success: result.exitCode === 0
              });
            } catch (error) {
              if (results.errors) {
                results.errors.push(`Failed to execute ${cmd}: ${(error as Error).message}`);
              }
              await sendProgress({
                type: 'command-error',
                command: cmd,
                error: (error as Error).message
              });
            }
          }
        }

        // Vite dev-server uses HMR (Hot Module Replacement)
        // No restart required - changes are automatically picked up
        console.log('[apply-ai-code-stream] Files written, HMR will update iframe automatically');

        // Send final results
        console.log('[TRACE] before sendProgress complete');
        await sendProgress({
          type: 'complete',
          results,
          explanation: parsed.explanation,
          structure: parsed.structure,
          message: `Successfully applied ${results.filesCreated.length} files`
        });
        console.log('[TRACE] after sendProgress complete');

        // Track applied files in conversation state
        if (global.conversationState && results.filesCreated.length > 0) {
          const messages = global.conversationState.context.messages;
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'user') {
              lastMessage.metadata = {
                ...lastMessage.metadata,
                editedFiles: results.filesCreated
              };
            }
          }

          // Track applied code in project evolution
          if (global.conversationState.context.projectEvolution) {
            global.conversationState.context.projectEvolution.majorChanges.push({
              timestamp: Date.now(),
              description: parsed.explanation || 'Code applied',
              filesAffected: results.filesCreated || []
            });
          }

          global.conversationState.lastUpdated = Date.now();
        }

      } catch (error) {
        await sendProgress({
          type: 'error',
          error: (error as Error).message
        });
      } finally {
        await writer.close();
      }
    })(provider, request);

    // Return the stream
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Apply AI code stream error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse AI code' },
      { status: 500 }
    );
  }
}