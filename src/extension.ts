// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as childproc from 'child_process';
import { FictionModel } from './FictionModel';
import * as path from 'path';

const FICTION_JSON = "fiction.json";

var model: FictionModel;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	// console.log('Congratulations, your extension "fictioner" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	if (!vscode.workspace.workspaceFolders || !vscode.workspace.workspaceFolders[0]) {
		vscode.window.showErrorMessage("Open workspace to enable Fictioner");
		return;
	}

	let wsPath = vscode.workspace.workspaceFolders[0].uri.path;
	let jsonPath = path.join(wsPath, FICTION_JSON);
	if (!fs.existsSync(jsonPath)) {
		// create fiction.json
		let jsonContent = 
			`{\n` + 
			`    "title": "${path.basename(wsPath)}",\n` +
			`    "content": [\n` +
			`    ]\n` +
			`}\n`;
		fs.writeFile(jsonPath, jsonContent, () => {
			// open the file in the editor
			vscode.window.showTextDocument(vscode.Uri.file(jsonPath), {preview: false});
		});
	}

	let disposables: vscode.Disposable[] = [];

	let regcmd = function(name:string, f: ()=>void ) {
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

	regcmd('fictioner.itemUp', () => {
		vscode.window.showInformationMessage('itemUp() called');
	});

	// vscode.window.createTreeView('fictionView', {
	// 	treeDataProvider: new FictionDataProvider(vscode.workspace.workspaceFolders![0].uri.path)
	// });
	model = new FictionModel(vscode.workspace.workspaceFolders![0].uri.path, FICTION_JSON);
	model.reload().then(()=>{
		// register view after doc model is initialized
		disposables.push(vscode.window.registerTreeDataProvider(
			'fictionView',
			model
		  ));
	});

	// intellisense for hashtags
	disposables.push(vscode.languages.registerCompletionItemProvider(
		'markdown', model, '#'
	));

	context.subscriptions.concat(disposables);

	vscode.commands.executeCommand('setContext', 'fictionJsonExists', true);
}

// this method is called when your extension is deactivated
export function deactivate() {}

function compile() {
	vscode.window.showInformationMessage('compile() called');
	let cmd = "pandoc -o out.docx " + model.getFilePaths(true).join(' ');
	let foo = childproc.exec(cmd, {cwd: model.workspaceRoot}, 
		(error: childproc.ExecException|null, stdout:string, stderr:string) => {
		   if (error) {
			   console.log('error: ' + error);
		   } else {
			console.log('command: ' + cmd);
			console.log('stdout: ' + stdout);
			console.log('stderr: ' + stderr);      
		   }
	    });
}