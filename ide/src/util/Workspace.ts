'use strict';

import * as vscode from "vscode";
import * as fse from "fs-extra";

/* tslint:disable:no-any */
export namespace Workspace {

    export function getDefaultWorkspace(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('tol');
    }

    export function getWorkspace(storagePath: vscode.Uri): vscode.Uri {
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const workspace = getDefaultWorkspace().get<string>('workspace');
        if (workspace && workspace !== '') {
            fse.ensureDir(workspace);
            return vscode.Uri.parse(workspace);
        }
        return vscode.Uri.joinPath(storagePath, 'server');
    }

    export function loadList(config: string): any[] {
        try {
            return fse.existsSync(config) ? fse.readJsonSync(config) : [];
        } catch (err) {
            console.error(err);
        }
        return [];
    }

    export function saveList(config: string, list: any[]): void {
        try {
            fse.outputJsonSync(config, list);
        } catch (err: any) {
            console.error(err.toString());
        }
    }

    export async function readFileNames(uri: vscode.Uri): Promise<string[]> {
        await fse.ensureDir(uri.fsPath);
        return await fse.readdir(uri.fsPath);
    }

    export function removeDir(uri: vscode.Uri): void {
        fse.remove(uri.fsPath);
    }
}
