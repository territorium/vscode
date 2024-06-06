'use strict';

// import * as vscode from 'vscode';
import { workspace } from 'vscode';

export function get() {
    const config = workspace.getConfiguration();
    // const vsconfig = workspace.getConfiguration('SmileDB');
    return {
        lsp: {
            uri: config.get('languageServerSettings.websocket', 'localhost:8088/lsp/service') as string
        }
    };
}