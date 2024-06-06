/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';


import { LspSocket } from "./lspdaemon";
import { ProjectModel } from "./project/ProjectModel";
import { ProjectProvider } from "./project/ProjectProvider";


// this method is called when vs code is activated
export async function activate(context: vscode.ExtensionContext) {
	let storageUri: vscode.Uri = context.globalStorageUri;

	const projectModel = new ProjectModel(storageUri.path, context);
	const projectProvider = new ProjectProvider(projectModel, context);

	vscode.window.registerTreeDataProvider('projectExplorer', projectProvider);

	const languageClient = new LspSocket(context);
	languageClient.start();

	context.subscriptions.push(languageClient);
}

export async function deactivate(): Promise<void> {
}
