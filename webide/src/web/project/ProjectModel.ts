'use strict';

import * as vscode from "vscode";
import { Project } from "./Project";
import path from "path";

export class ProjectModel {

    private _items: Project[] = [];

    constructor(public defaultStoragePath: string, context: vscode.ExtensionContext) {
        this.scan();
        vscode.workspace.onDidChangeWorkspaceFolders((e: vscode.WorkspaceFoldersChangeEvent) => {
            this.scan();
        });
    }

    public async scan(): Promise<void> {
        this._items = [];
        let paths = vscode.workspace.workspaceFolders?.map(f => f) ?? [];

        await vscode.workspace.findFiles("{context.properties,smartIO/context.properties}").then((uris: vscode.Uri[]) => {
            uris.forEach(uri =>
                paths.filter(p => uri.path.startsWith(p.uri.path)).forEach(p => this._items.push(new Project(p)))
            );
        });

        vscode.commands.executeCommand('tol.refreshProjectView');
    }

    public getList(): Project[] {
        return this._items;
    }

    public getByName(name: string): Project | undefined {
        return this._items.find((i) => i.getName() === name);
    }
}
