'use strict';


import * as vscode from 'vscode';

import { LanguageClient } from "./monaco";
import { LanguageClientOptions, CloseAction, ErrorAction, Disposable } from 'vscode-languageclient';
// import { LanguageClient } from 'vscode-languageclient/browser';

import * as Config from "./config";

/*
 * all except the code to create the language client in not browser specific
 * and could be shared with a regular (Node) extension
 */
// const documentSelector = [{ language: 'plaintext' }];
const documentSelector = [{ pattern: '**/*.ui.xml' }];

export class LspSocket implements Disposable {

    private client: LanguageClient | undefined;
    private status: vscode.StatusBarItem;


    constructor(context: vscode.ExtensionContext) {
        context.subscriptions.push(vscode.commands.registerCommand('lspclient.start', () => this.start()));
        context.subscriptions.push(vscode.commands.registerCommand('lspclient.stop', () => this.stop()));

        this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.updateStatus(false);
        this.status.show();

        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('languageServerSettings.websocket')) {
                this.updateStatus(false);
            }
        });

    }

    public updateStatus(isRunning: boolean) {
        let wsUri: string = Config.get().lsp.uri;
        // let conf = vscode.workspace.getConfiguration('LogServer');
        // 		let host: string = conf.get("host") as string;
        // 		let port: number = conf.get("port") as number;

        this.status.command = isRunning ? "lspclient.stop" : "lspclient.start";
        this.status.text = isRunning ? "$(debug-start) Lsp" : "$(debug-stop) Lsp";
        this.status.tooltip = `Language Client on '${wsUri}'`;
    }

    public start() {
        let wsUri: string = Config.get().lsp.uri;

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
            this.client = new LanguageClient('lsp-web-extension-sample', 'LSP Web Extension Sample', clientOptions, socket);
            this.client.start();
            this.client.onDidChangeState(() => { });
            this.updateStatus(true);
        };
        socket.onclose = () => {
            this.client?.stop();
            this.client?.dispose();
            this.client = undefined;
            this.updateStatus(false);
        };

        vscode.window.showInformationMessage('lsp-web-extension-sample server is ready');
    }

    public stop() {
        this.client?.stop();
        this.client?.dispose();
        this.client = undefined;
        this.updateStatus(false);
    }

    public async dispose() {
        if (this.client !== undefined) {
            await this.client.stop();
        }
        this.status.dispose();
    }
}