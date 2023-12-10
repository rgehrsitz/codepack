import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Activation function for the extension
export function activate (context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('codepack.extractProject', async () => {
		const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
		if (!rootPath) {
			vscode.window.showErrorMessage('No project open');
			return;
		}

		try {
			const options = await getUserOptions();
			const projectStructure = await extractProjectStructure(rootPath, options);
			const output = JSON.stringify(projectStructure, null, 2);

			vscode.workspace.openTextDocument({ content: output, language: 'json' }).then(doc => {
				vscode.window.showTextDocument(doc);
			});
		} catch (error) {
			const errorMessage = `Error extracting project structure: ${(error as Error).message}`;
			vscode.window.showErrorMessage(errorMessage);
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
	type: 'file' | 'directory' | 'binary';
	content?: string;
	children?: FileData[];
}

// Function to extract project structure
async function extractProjectStructure (dir: string, options: UserOptions): Promise<FileData[]> {
	let results: FileData[] = [];

	try {
		const items = await fs.promises.readdir(dir, { withFileTypes: true });

		for (const item of items) {
			if (item.isDirectory()) {
				const children = await extractProjectStructure(path.join(dir, item.name), options);
				results.push({ name: item.name, type: 'directory', children });
			} else {
				let type: 'file' | 'binary' = 'file';
				let content: string | undefined = undefined;

				if (shouldBeIncluded(item.name, options)) {
					content = await fs.promises.readFile(path.join(dir, item.name), 'utf8');
				} else if (isBinaryFile(item.name)) {
					type = 'binary';
				}

				results.push({ name: item.name, type, content });
			}
		}
	} catch (error) {
		console.error(`Error reading directory ${dir}: ${error}`);
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
