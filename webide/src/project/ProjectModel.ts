'use strict';

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

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
        this._items = vscode.workspace.workspaceFolders?.filter((f: vscode.WorkspaceFolder): boolean => {
            const p1 = path.join(f.uri.path, "context.properties");
            const p2 = path.join(f.uri.path, "smartIO", "context.properties");
            return fs.existsSync(p1) || fs.existsSync(p2);
        }).map(f => new Project(f)) ?? [];

        vscode.commands.executeCommand('tol.refreshProjectView');
    }

    public getList(): Project[] {
        return this._items;
    }

    public getByName(name: string): Project | undefined {
        return this._items.find((i) => i.getName() === name);
    }
}
