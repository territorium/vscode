'use strict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { ServerModel } from "./server/ServerModel";
import { ServerController } from "./server/ServerController";
import { ServerTreeModel } from "./server/ServerTreeModel";
import { ServerTreeProvider, ServerTreeItem } from "./server/ServerTreeProvider";

import { ProjectModel } from "./project/ProjectModel";
import { ProjectController } from "./project/ProjectController";
import { ProjectTreeProvider } from "./project/ProjectTreeProvider";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let storageUri: vscode.Uri = context.globalStorageUri;
	// let storageUri: vscode.Uri = context.storageUri;

	const model0 = new ProjectModel(storageUri.path, context);
	// const controller0 = new ProjectController(model0, context);
	const treeProvider0 = new ProjectTreeProvider(model0, context);

	vscode.window.registerTreeDataProvider('projectExplorer', treeProvider0);

	const model = new ServerModel(storageUri.fsPath, context);
	const controller = new ServerController(model);
 	const treeProvider = new ServerTreeProvider(model, context);

	vscode.window.registerTreeDataProvider('serverExplorer', treeProvider);

	vscode.commands.registerCommand('server.add', () => controller.addServer());
	vscode.commands.registerCommand('server.delete', (item: ServerTreeItem) => controller.deleteServer(item));

	vscode.commands.registerCommand('server.start', (item: ServerTreeItem) => controller.startServer(item));
	vscode.commands.registerCommand('server.debug', (item: ServerTreeItem) => controller.startServer(item, true));
	vscode.commands.registerCommand('server.stop', (item: ServerTreeItem) => controller.stopOrRestartServer(item.getServer()));
	vscode.commands.registerCommand('server.restart', (item: ServerTreeItem) => controller.stopOrRestartServer(item.getServer(), true));

	vscode.commands.registerCommand('server.app', (item: ServerTreeItem) => controller.openApplication(item));
	vscode.commands.registerCommand('server.admin', (item: ServerTreeItem) => controller.openAdminPanel(item));

	vscode.commands.registerCommand('server.model', (item: ServerTreeModel) => controller.selectModel(item));
}
