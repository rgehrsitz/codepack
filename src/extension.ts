import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Activation function for the extension
export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('codepack.extractProject', async () => {
        const selectedFiles = vscode.window.activeTextEditor?.document.uri.fsPath || vscode.workspace.workspaceFolders?.[0].uri.fsPath;
if (!selectedFiles) {
	vscode.window.showErrorMessage('No files or project open');
	return;
}

try {
	const projectStructure = await extractProjectStructure(selectedFiles);
	const output = JSON.stringify(projectStructure, null, 2);

	vscode.workspace.openTextDocument({ content: output, language: 'json' }).then(doc => {
		vscode.window.showTextDocument(doc);
	});
} catch (error) {
	const errorMessage = (error as Error).message;
	vscode.window.showErrorMessage(`Error extracting project structure: ${errorMessage}`);
}
    });

    context.subscriptions.push(disposable);
}

// Function to deactivate the extension
export function deactivate () { }

// Function to get user options for file types to include and exclude
async function getUserOptions (): Promise<UserOptions> {
	const includeFileTypes = await vscode.window.showInputBox({ prompt: 'Enter file types to include (comma-separated):' });
	const excludeFileTypes = await vscode.window.showInputBox({ prompt: 'Enter file types to exclude (comma-separated):' });

	return {
		includeFileTypes: includeFileTypes ? includeFileTypes.split(',').map(s => s.trim()) : [],
		excludeFileTypes: excludeFileTypes ? excludeFileTypes.split(',').map(s => s.trim()) : []
	};
}

// Interface for user options
interface UserOptions {
	includeFileTypes: string[];
	excludeFileTypes: string[];
}

// Interface for file data
interface FileData {
    name: string;
    type: 'file' | 'directory';
    content?: string;
    children?: FileData[];
}

// Function to extract project structure
// Function to extract project structure
async function extractProjectStructure(selectedPath: string): Promise<FileData[]> {
    let results: FileData[] = [];

    try {
        const stat = await fs.promises.stat(selectedPath);
        if (stat.isDirectory()) {
            const items = await fs.promises.readdir(selectedPath, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(selectedPath, item.name);
                const childStat = await fs.promises.stat(fullPath);
                if (childStat.isDirectory()) {
                    const children = await extractProjectStructure(fullPath);
                    results.push({ name: item.name, type: 'directory', children });
                } else {
                    const content = await fs.promises.readFile(fullPath, 'utf8');
                    results.push({ name: item.name, type: 'file', content });
                }
            }
        } else {
            const content = await fs.promises.readFile(selectedPath, 'utf8');
            results.push({ name: path.basename(selectedPath), type: 'file', content });
        }
    } catch (error) {
        console.error(`Error reading directory or file ${selectedPath}: ${error}`);
        throw error;
    }

    return results;
}

// Function to check if a file should be included
function shouldBeIncluded (fileName: string, options: UserOptions): boolean {
	const fileExtension = path.extname(fileName).toLowerCase();
	if (options.excludeFileTypes.includes(fileExtension)) {
		return false;
	}
	if (options.includeFileTypes.length === 0 || options.includeFileTypes.includes(fileExtension)) {
		return true;
	}
	return false;
}

// Function to check if a file is binary
function isBinaryFile (fileName: string): boolean {
	const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.zip', '.tar', '.gz', '.rar', '.exe', '.dll', '.so', '.bin'];
	const fileExtension = path.extname(fileName).toLowerCase();
	return binaryExtensions.includes(fileExtension);
}
