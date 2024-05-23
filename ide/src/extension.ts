'use strict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { ServerModel } from "./server/ServerModel";
import { ServerController } from "./server/ServerController";
import { ServerTreeProvider, ServerTreeItem } from "./server/ServerTreeProvider";


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let storageUri: vscode.Uri = context.globalStorageUri;
	// let storageUri: vscode.Uri = context.storageUri;

	const model = new ServerModel(storageUri, context);
	const controller = new ServerController(model, context);
	const treeProvider = new ServerTreeProvider(model, context);

	vscode.window.registerTreeDataProvider('serverExplorer', treeProvider);

	vscode.commands.registerCommand('server.add', () => controller.addServer());
	vscode.commands.registerCommand('server.delete', (item: ServerTreeItem) => controller.deleteServer(item.getServer()));

	vscode.commands.registerCommand('server.start', (item: ServerTreeItem) => controller.startServer(item.getServer()));
	vscode.commands.registerCommand('server.debug', (item: ServerTreeItem) => controller.startServer(item.getServer(), true));
	vscode.commands.registerCommand('server.stop', (item: ServerTreeItem) => controller.stopOrRestartServer(item.getServer()));
	vscode.commands.registerCommand('server.restart', (item: ServerTreeItem) => controller.stopOrRestartServer(item.getServer(), true));

	vscode.commands.registerCommand('server.app', (item: ServerTreeItem) => controller.openExternal(item.getServer(), "http://localhost:8080/smartio/fm"));
	vscode.commands.registerCommand('server.admin', (item: ServerTreeItem) => controller.openExternal(item.getServer(), "http://localhost:8088"));

	vscode.commands.registerCommand('server.model', (item: ServerTreeItem) => controller.selectModel(item.getServer()));

	// vscode.commands.registerCommand('chrome.debug', () => {
	// 	ProcessBuilder.execute2("/opt/google/chrome/chrome",{ shell: true }, "--remote-debugging-port=9222", "--user-data-dir=/home/brigl/.local/share/TOL/devtools/chrome-tmp", "--headless", "--disable-gpu");
	// });
}
