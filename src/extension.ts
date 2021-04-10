// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as childproc from 'child_process';
import { FictionModel, Hashtag } from './FictionModel';
import * as path from 'path';

const CONFIG_FILE = "fictioner.yml";

var model: FictionModel;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	if (!vscode.workspace.workspaceFolders || !vscode.workspace.workspaceFolders[0]) {
		vscode.window.showErrorMessage("Open workspace to enable Fictioner");
		return;
	}

	let wsPath = vscode.workspace.workspaceFolders[0].uri.path;
	let configPath = path.join(wsPath, CONFIG_FILE);
	if (!fs.existsSync(configPath)) {
		// create fiction.json
		let yamlContent = 
			`title: ${path.basename(wsPath)}\n` +
			'contents:\n' +
			'  - src/*.md\n';
		fs.writeFile(configPath, yamlContent, () => {
			// open the file in the editor
			vscode.window.showTextDocument(vscode.Uri.file(configPath), {preview: false});
		});
	}

	let disposables: vscode.Disposable[] = [];

	function regcmd(name:string, f: (param?:any)=>void ) {
		disposables.push(vscode.commands.registerCommand(name, f));
	};

	regcmd('fictioner.enable', () => {
		// enabling will be done by above code
	});
	
	regcmd('fictioner.refresh', () => {
		model.reload();
	});
	
	regcmd('fictioner.compile', () => {
		compile();
	});

	regcmd('fictioner.open', (...args:any[]) => {
		// console.log(`showing ${args[0]}`);
		vscode.window.showTextDocument(vscode.Uri.file(args[0]), {preview: false});
	});

	regcmd('fictioner.openAndSelect', (...args:any[]) => {
		// console.log(`showing ${args[0]}`);
		vscode.window.showTextDocument(vscode.Uri.file(args[0]), {preview: false}).then(
			(editor:vscode.TextEditor)=>{
				let range = args[1] as vscode.Range;
				editor.revealRange(range);
				editor.selection = new vscode.Selection(range.start, range.end);
			}
		);
	});

	regcmd('fictioner.searchtag', (item: any) => {
		if (item instanceof Hashtag) {
			vscode.commands.executeCommand('workbench.action.findInFiles', {
				query: `#${item.id}[!?\\s-]`,
				triggerSearch: true,
				isRegex: true
			});
		}
	});

	let diagCollection = vscode.languages.createDiagnosticCollection('fictioner');
	disposables.push(diagCollection);

	model = new FictionModel(vscode.workspace.workspaceFolders![0].uri.path, CONFIG_FILE, diagCollection);

	await model.reload();
	
	// register view after doc model is initialized
	disposables.push(vscode.window.registerTreeDataProvider(
		'fictionView',
		model
	));

	// intellisense for hashtags
	disposables.push(vscode.languages.registerCompletionItemProvider(
		'markdown', model, '#'
	));

	context.subscriptions.concat(disposables);

	vscode.commands.executeCommand('setContext', 'fictionerEnabled', true);
}

// this method is called when your extension is deactivated
export function deactivate() {}

function compile() {
	vscode.window.showInformationMessage('compile() called');

	if (vscode.window.terminals.length===0) {
		vscode.window.createTerminal();
	}

	let cmd = "pandoc -o out.docx " + model.getFilePaths(true).join(' ');
	vscode.window.terminals[0].sendText(cmd);
}