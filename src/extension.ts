import * as vscode from 'vscode';
import { Uri, window, workspace } from 'vscode';
import { FictionModel, Hashtag } from './FictionModel';
import { AnalyticsView } from './Analytics';
import { readTextFile, writeTextFile, formatString, openAndSelectLine } from './Util';


const CONFIG_FILE = "fictioner.yml";
export const EXT_NAME = "fictioner";

// const analViewUri = Uri.parse(EXT_NAME + ":( Fiction Analysis ).md");
// export let analyticsView: vscode.WebviewPanel | undefined;

let model: FictionModel;
export let analyticsView: AnalyticsView;

export function homeDir(): Uri | undefined {
	return workspace?.workspaceFolders?.[0].uri;
}

export function configFile(): Uri | undefined {
	const home = homeDir();
	return home ? Uri.joinPath(home, CONFIG_FILE) : undefined;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	if (!homeDir()) {
		window.showErrorMessage("Open workspace to enable Fictioner");
		return;
	}

	const config = configFile()!;

	try {
		// if config file does not exist in the workspace...
		await workspace.fs.stat(config);
	} catch {
		// then create one from the template
		const newConfig = formatString(configTemplate, new Map([["title", workspace.name!]]));
		await writeTextFile(config, newConfig);
		openConfig(); // show config file
	}

	const disposables: vscode.Disposable[] = [];

	function regCmd(name: string, f: (param?: any) => void) {
		disposables.push(vscode.commands.registerCommand(name, f));
	};

	regCmd('fictioner.enable', () => {
		console.log("fictioner.enable command executed");
	}); // enabling will be done by above code
	regCmd('fictioner.refresh', () => { model.scan(); }); // wrapper function is needed becase model is undefined yet
	regCmd('fictioner.compile', compile);
	regCmd('fictioner.config', openConfig);
	regCmd('fictioner.open', (...args: any[]) => {
		// console.log(`showing ${args[0]}`);
		window.showTextDocument(Uri.file(args[0]), { preview: false });
	});

	regCmd('fictioner.openAndSelect', (...args: any[]) => {
		const uri = vscode.Uri.file(args[0] as string);
		openAndSelectLine(uri, args[1] as number);
	});

	regCmd('fictioner.searchtag', (item: any) => {
		if (item instanceof Hashtag) {
			vscode.commands.executeCommand('workbench.action.findInFiles', {
				query: `#${item.id}[!?\\s-]`,
				triggerSearch: true,
				isRegex: true
			});
		}
	});

	regCmd('fictioner.analytics', async () => {
		openAnalytics();
	});
	
	model = new FictionModel();

	// analytics view
	analyticsView = new AnalyticsView(context, model);
	disposables.push(model);

	await model.scan();

	// register view after doc model is initialized
	disposables.push(window.registerTreeDataProvider(
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
export function deactivate() { }

function compile() {
	// window.showInformationMessage('compile() called');
	if (window.terminals.length === 0) {
		window.createTerminal();
	}

	const cmd = model.config.compile.trim() ?? 'pandoc -o out.docx';
	const args = model.getFilePaths(true).map((p) => `"${p}"`).join(' ');
	window.terminals[0].sendText(cmd + ' ' + args);
}

function openConfig() {
	window.showTextDocument(configFile()!, { preview: false });
}

async function openAnalytics() {
	analyticsView.show();
}

const configTemplate = `# Fictioner sample config file
title: {title}

# List .md files. Files will be included in the order specified here. 
# Wildcards can be used and matched files will included in alphabetical order.     
contents:
  - contents/*.md

# Change following command line to your taste.
# Refer to https://pandoc.org/MANUAL.html for pandoc's command line options
compile: >
  pandoc -o "{title}.docx"
  -N --top-level-division=chapter -V fontsize=11pt -V papersize:"a4paper" -V geometry:margin=1in
`;