'use strict';

import * as vscode from "vscode";
import * as path from "path";

import { INI, Parameter, Utility } from "../util/Utility";


const FILTER: RegExp = new RegExp("^[^\.]+\.(ui\.xml|xml|properties|js)$", "i");


export class ProjectNode {

    constructor(private name: string, private type: string, protected uri: vscode.Uri) {
    }

    public getName(): string {
        return this.name;
    }

    public getType(): string {
        return this.type;
    }

    public getUri(): vscode.Uri {
        return this.uri;
    }

    public async getChildren(): Promise<ProjectNode[]> {
        return [];
    }
}


export class Project extends ProjectNode {

    constructor(private folder: vscode.WorkspaceFolder) {
        super(folder.name, "project", folder.uri);
        const uri2 = vscode.Uri.joinPath(folder.uri, "smartIO");
        vscode.workspace.fs.stat(vscode.Uri.joinPath(uri2, "context.properties")).then(() => this.uri = uri2);

    }

    public async getChildren(): Promise<ProjectNode[]> {
        let uris = await vscode.workspace.findFiles("**/context.properties");
        uris.forEach(i => console.log(i));

        const config = await INI.parse(vscode.Uri.joinPath(this.uri, "context.properties"));
        const list = config.keys().filter(k => k.startsWith("model.")) ?? [];
        return list.map(k => new ModelTreeItem(k.substring(6), this.uri, config.get(k))) ?? [];
    }

    public static isValid(folder: vscode.WorkspaceFolder): boolean {
        const p1 = path.join(folder.uri.path, "context.properties");
        const p2 = path.join(folder.uri.path, "smartIO", "context.properties");
        return true;//fs.existsSync(p1) || fs.existsSync(p2);
    }
}


abstract class AbstractProjectNode extends ProjectNode {

    constructor(name: string, type: string, uri: vscode.Uri) {
        super(name, type, uri);
        this.uri = uri;
    }

    public async getChildren(): Promise<ProjectNode[]> {
        const children: FileTreeItem[] = [];
        try {
            const array = await vscode.workspace.fs.readDirectory(this.uri);
            array.filter((value, index, array) => FILTER.test(value[0])).forEach((value, index, array) => {
                children.push(new FileTreeItem(vscode.Uri.joinPath(this.uri, value[0])));
            });

            children.sort((f1, f2) => {
                if (f1.isLeaf() && !f2.isLeaf()) { return 1; }
                if (f2.isLeaf() && !f1.isLeaf()) { return -1; }
                return f1.filename.localeCompare(f2.filename);
            });
        } catch (err) {
            console.error(err);
        }
        return children;
    }
}


export class ModelTreeItem extends AbstractProjectNode {

    private lines: string[] = [];

    constructor(name: string, uri: vscode.Uri, private parameter: Parameter) {
        super(name, "model", vscode.Uri.joinPath(uri, parameter["path"] ?? name));
        const uri2 = vscode.Uri.joinPath(this.uri, "modules.txt");
        vscode.workspace.fs.stat(uri2).then(() => Utility.readLines(uri2, this.lines));
    }

    public async getChildren(): Promise<ProjectNode[]> {
        const children: FileTreeItem[] = [];
        try {
            const array = await vscode.workspace.fs.readDirectory(this.uri);
            array.filter((value, index, array) => FILTER.test(value[0])).forEach((value, index, array) => {
                children.push(new FileTreeItem(vscode.Uri.joinPath(this.uri, value[0])));
            });
            const uri = vscode.Uri.joinPath(this.uri, "..", "..", "smartio-config", "fm");
            this.lines.forEach(n => children.push(new FileTreeItem(vscode.Uri.joinPath(uri, n))));

            children.sort((f1, f2) => {
                if (f1.isLeaf() && !f2.isLeaf()) { return 1; }
                if (f2.isLeaf() && !f1.isLeaf()) { return -1; }
                return f1.filename.localeCompare(f2.filename);
            });
        } catch (err) {
            console.error(err);
        }
        return children;
    }
}


export class FileTreeItem extends AbstractProjectNode {

    public filename: string;

    constructor(uri: vscode.Uri) {
        super(path.basename(uri.fsPath), path.basename(uri.fsPath).indexOf(".") < 0 ? "folder" : "file", uri);
        this.filename = path.basename(uri.fsPath);
    }

    public isLeaf(): boolean {
        return this.getType() !== "folder";
    }
}
