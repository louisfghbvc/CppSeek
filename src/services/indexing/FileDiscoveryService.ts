import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createHash } from 'crypto';

export interface FileInfo {
    path: string;
    relativePath: string;
    size: number;
    lastModified: Date;
    hash: string;
    extension: string;
    directory: string;
    basename: string;
}

export interface ScanProgress {
    scannedFiles: number;
    totalEstimate: number;
    currentDirectory: string;
    startTime: Date;
    errors: string[];
}

export interface ScanResult {
    files: FileInfo[];
    totalFiles: number;
    scanTime: number;
    directoriesScanned: number;
    errors: string[];
    performance: {
        filesPerSecond: number;
        averageFileSize: number;
        totalSizeBytes: number;
    };
}

export class FileDiscoveryService {
    private outputChannel: vscode.OutputChannel;
    private isScanning: boolean = false;
    private scanAbortController: AbortController | null = null;
    
    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    /**
     * Discover all C/C++ files in the workspace with progress reporting
     */
    async discoverFiles(
        progress?: vscode.Progress<{ message?: string; increment?: number }>,
        token?: vscode.CancellationToken
    ): Promise<ScanResult> {
        if (this.isScanning) {
            throw new Error('File discovery is already in progress');
        }

        this.isScanning = true;
        this.scanAbortController = new AbortController();
        
        const startTime = Date.now();
        const scanProgress: ScanProgress = {
            scannedFiles: 0,
            totalEstimate: 0,
            currentDirectory: '',
            startTime: new Date(),
            errors: []
        };

        try {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] Starting workspace file discovery...`);
            
            // Get workspace configuration
            const config = vscode.workspace.getConfiguration('cppseek');
            const includePatterns = config.get<string[]>('files.include', [
                '**/*.cpp', '**/*.cxx', '**/*.cc', '**/*.c', 
                '**/*.h', '**/*.hpp', '**/*.hxx'
            ]);
            const excludePatterns = config.get<string[]>('files.exclude', [
                '**/node_modules/**', '**/build/**', '**/out/**', '**/dist/**',
                '**/.git/**', '**/CMakeFiles/**', '**/*.o', '**/*.obj'
            ]);

            this.outputChannel.appendLine(`Include patterns: ${includePatterns.join(', ')}`);
            this.outputChannel.appendLine(`Exclude patterns: ${excludePatterns.join(', ')}`);

            // Get workspace folders
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder is open');
            }

            progress?.report({ message: 'Scanning workspace folders...', increment: 0 });

            const allFiles: FileInfo[] = [];
            let directoriesScanned = 0;
            let totalSizeBytes = 0;

            // Process each workspace folder
            for (const folder of workspaceFolders) {
                if (token?.isCancellationRequested || this.scanAbortController?.signal.aborted) {
                    throw new Error('Scan cancelled by user');
                }

                this.outputChannel.appendLine(`Scanning workspace folder: ${folder.uri.fsPath}`);
                
                try {
                    // Use VSCode's file search API for efficiency
                    const files = await this.findFilesInWorkspace(
                        folder,
                        includePatterns,
                        excludePatterns,
                        scanProgress,
                        progress,
                        token
                    );
                    
                    allFiles.push(...files);
                    directoriesScanned++;
                    
                } catch (error) {
                    const errorMsg = `Error scanning folder ${folder.uri.fsPath}: ${error}`;
                    this.outputChannel.appendLine(errorMsg);
                    scanProgress.errors.push(errorMsg);
                }
            }

            // Calculate performance metrics
            const scanTime = Date.now() - startTime;
            totalSizeBytes = allFiles.reduce((sum, file) => sum + file.size, 0);
            const filesPerSecond = allFiles.length / (scanTime / 1000);
            const averageFileSize = allFiles.length > 0 ? totalSizeBytes / allFiles.length : 0;

            const result: ScanResult = {
                files: allFiles,
                totalFiles: allFiles.length,
                scanTime,
                directoriesScanned,
                errors: scanProgress.errors,
                performance: {
                    filesPerSecond,
                    averageFileSize,
                    totalSizeBytes
                }
            };

            this.outputChannel.appendLine(
                `[${new Date().toISOString()}] File discovery completed: ` +
                `${result.totalFiles} files found in ${scanTime}ms ` +
                `(${filesPerSecond.toFixed(1)} files/sec)`
            );

            if (result.errors.length > 0) {
                this.outputChannel.appendLine(`Encountered ${result.errors.length} errors during scan`);
            }

            progress?.report({ message: `Found ${result.totalFiles} C/C++ files`, increment: 100 });

            return result;

        } catch (error) {
            const errorMsg = `File discovery failed: ${error}`;
            this.outputChannel.appendLine(errorMsg);
            throw error;
        } finally {
            this.isScanning = false;
            this.scanAbortController = null;
        }
    }

    /**
     * Find files using VSCode's workspace API for efficiency
     */
    private async findFilesInWorkspace(
        folder: vscode.WorkspaceFolder,
        includePatterns: string[],
        excludePatterns: string[],
        scanProgress: ScanProgress,
        progress?: vscode.Progress<{ message?: string; increment?: number }>,
        token?: vscode.CancellationToken
    ): Promise<FileInfo[]> {
        const files: FileInfo[] = [];
        
        // Create include pattern for VSCode API
        const includePattern = new vscode.RelativePattern(
            folder,
            includePatterns.length === 1 ? includePatterns[0] : `{${includePatterns.join(',')}}`
        );

        // Create exclude pattern
        const excludePattern = excludePatterns.length > 0 ? 
            `{${excludePatterns.join(',')}}` : undefined;

        try {
            // Use VSCode's optimized file finding
            const uris = await vscode.workspace.findFiles(
                includePattern,
                excludePattern,
                10000, // Max files limit from config
                token
            );

            this.outputChannel.appendLine(`Found ${uris.length} potential files in ${folder.name}`);

            // Process files in batches for progress reporting
            const batchSize = 100;
            for (let i = 0; i < uris.length; i += batchSize) {
                if (token?.isCancellationRequested || this.scanAbortController?.signal.aborted) {
                    throw new Error('Scan cancelled');
                }

                const batch = uris.slice(i, i + batchSize);
                const progressPercent = Math.round((i / uris.length) * 100);
                
                progress?.report({ 
                    message: `Processing files: ${i + batch.length}/${uris.length}`,
                    increment: progressPercent > 0 ? 1 : 0
                });

                // Process batch of files
                for (const uri of batch) {
                    try {
                        const fileInfo = await this.createFileInfo(uri, folder.uri.fsPath);
                        if (fileInfo) {
                            files.push(fileInfo);
                            scanProgress.scannedFiles++;
                        }
                    } catch (error) {
                        const errorMsg = `Error processing file ${uri.fsPath}: ${error}`;
                        scanProgress.errors.push(errorMsg);
                        this.outputChannel.appendLine(errorMsg);
                    }
                }
            }

        } catch (error) {
            throw new Error(`Failed to find files in workspace: ${error}`);
        }

        return files;
    }

    /**
     * Create FileInfo object from URI with metadata
     */
    private async createFileInfo(uri: vscode.Uri, workspaceRoot: string): Promise<FileInfo | null> {
        try {
            const stats = await fs.stat(uri.fsPath);
            
            // Skip directories and non-regular files
            if (!stats.isFile()) {
                return null;
            }

            // Calculate relative path
            const relativePath = path.relative(workspaceRoot, uri.fsPath);
            
            // Create file hash based on path and modification time for change detection
            const hashContent = `${relativePath}:${stats.mtime.getTime()}:${stats.size}`;
            const hash = createHash('md5').update(hashContent).digest('hex');

            const fileInfo: FileInfo = {
                path: uri.fsPath,
                relativePath,
                size: stats.size,
                lastModified: stats.mtime,
                hash,
                extension: path.extname(uri.fsPath).toLowerCase(),
                directory: path.dirname(relativePath),
                basename: path.basename(uri.fsPath)
            };

            return fileInfo;

        } catch (error) {
            // Log but don't throw - allows scan to continue
            this.outputChannel.appendLine(`Warning: Could not process file ${uri.fsPath}: ${error}`);
            return null;
        }
    }

    /**
     * Check if a file matches C/C++ patterns
     */
    isValidCppFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        const cppExtensions = ['.cpp', '.cxx', '.cc', '.c', '.h', '.hpp', '.hxx'];
        return cppExtensions.includes(ext);
    }

    /**
     * Get quick file count estimation for progress
     */
    async getFileCountEstimate(): Promise<number> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return 0;
            }

            let totalEstimate = 0;
            for (const folder of workspaceFolders) {
                // Quick estimate using basic pattern matching
                const uris = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(folder, '**/*.{cpp,h,hpp,cxx,cc,hxx,c}'),
                    null,
                    1000 // Limited for estimation
                );
                totalEstimate += uris.length;
            }

            return totalEstimate;
        } catch {
            return 0; // Return 0 if estimation fails
        }
    }

    /**
     * Cancel ongoing scan operation
     */
    cancelScan(): void {
        if (this.scanAbortController) {
            this.scanAbortController.abort();
            this.outputChannel.appendLine('File discovery scan cancelled by user');
        }
    }

    /**
     * Check if service is currently scanning
     */
    isCurrentlyScanning(): boolean {
        return this.isScanning;
    }
} 