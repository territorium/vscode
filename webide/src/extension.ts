/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';


import { LanguageClientOptions, CloseAction, ErrorAction } from 'vscode-languageclient';
import { LanguageClient } from "./monaco";
// import { LanguageClient } from 'vscode-languageclient/browser';

// import { ProjectModel } from "./project/ProjectModel";
// import { ProjectProvider } from "./project/ProjectProvider";


let client: LanguageClient | undefined;

// this method is called when vs code is activated
export async function activate(context: vscode.ExtensionContext) {
	const workbenchConfig = vscode.workspace.getConfiguration();

	let storageUri: vscode.Uri = context.globalStorageUri;
	let wsUri: string = workbenchConfig.get('languageServerSettings.websocket', 'localhost:8088/lsp/service');


	// const projectModel = new ProjectModel(storageUri.path, context);
	// const projectProvider = new ProjectProvider(projectModel, context);

	// vscode.window.registerTreeDataProvider('projectExplorer', projectProvider);

	/*
	 * all except the code to create the language client in not browser specific
	 * and could be shared with a regular (Node) extension
	 */
	// const documentSelector = [{ language: 'plaintext' }];
	const documentSelector = [{ pattern: '**/*.ui.xml' }];

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		documentSelector,
		// disable the default error handler
		errorHandler: {
			error: () => ({ action: ErrorAction.Continue }),
			closed: () => ({ action: CloseAction.DoNotRestart })
		}
	};

	const socket = new WebSocket('ws://' + wsUri);
	socket.onopen = () => {
		// create a language client connection from the JSON RPC connection on demand
		client = new LanguageClient('lsp-web-extension-sample', 'LSP Web Extension Sample', clientOptions, socket);
		client.start();
	};

	console.log('lsp-web-extension-sample server is ready');
}

export async function deactivate(): Promise<void> {
	if (client !== undefined) {
		await client.stop();
	}
}
