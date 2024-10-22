'use strict';

import * as vscode from "vscode";
import { Project } from "./Project";

export class ProjectModel {

    private _items: Project[] = [];

    constructor(public defaultStoragePath: string, context: vscode.ExtensionContext) {
        this.scan();
        vscode.workspace.onDidChangeWorkspaceFolders((e: vscode.WorkspaceFoldersChangeEvent) => {
            this.scan();
        });
    }

    public async scan(): Promise<void> {
        this._items = vscode.workspace.workspaceFolders?.filter((f: vscode.WorkspaceFolder): boolean => Project.isValid(f)).map(f => new Project(f)) ?? [];
        
        vscode.commands.executeCommand('tol.refreshProjectView');
    }

    public getList(): Project[] {
        return this._items;
    }

    public getByName(name: string): Project | undefined {
        return this._items.find((i) => i.getName() === name);
    }
}
