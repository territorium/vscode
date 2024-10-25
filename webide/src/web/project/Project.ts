'use strict';

import * as vscode from "vscode";
import * as path from "path";

import { INI, Parameter, Utility } from "../util/Utility";


const FILTER: RegExp = new RegExp("^[^\.]+\.(ui\.xml|xml|properties|js)$", "i");

function doFilter(name: string, type: vscode.FileType): boolean {
    return type === vscode.FileType.Directory || FILTER.test(name);
}

export enum ElementType {
    PROJECT = 0,
    MODEL = 1,
    FOLDER = 2,
    FILE = 64
}

export class ProjectNode {

    constructor(private name: string, private type: ElementType, protected uri: vscode.Uri) {
    }

    public getName(): string {
        return this.name;
    }

    public getType(): ElementType {
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
        super(folder.name, ElementType.PROJECT, folder.uri);
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
}


abstract class AbstractProjectNode extends ProjectNode {

    constructor(name: string, type: ElementType, uri: vscode.Uri) {
        super(name, type, uri);
        this.uri = uri;
    }

    public async getChildren(): Promise<ProjectNode[]> {
        const children: FileTreeItem[] = [];
        try {
            const array = await vscode.workspace.fs.readDirectory(this.uri);
            array.filter((value, index, array) => doFilter(value[0], value[1])).forEach((value, index, array) => {
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
        super(name, ElementType.MODEL, vscode.Uri.joinPath(uri, parameter["path"] ?? name));
        const uri2 = vscode.Uri.joinPath(this.uri, "modules.txt");
        vscode.workspace.fs.stat(uri2).then(() => Utility.readLines(uri2, this.lines));
    }

    public async getChildren(): Promise<ProjectNode[]> {
        const children: FileTreeItem[] = [];
        try {
            const array = await vscode.workspace.fs.readDirectory(this.uri);
            array.filter((value, index, array) => doFilter(value[0], value[1])).forEach((value, index, array) => {
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
        super(path.basename(uri.fsPath), path.basename(uri.fsPath).indexOf(".") < 0 ? ElementType.FOLDER : ElementType.FILE, uri);
        this.filename = path.basename(uri.fsPath);
    }

    public isLeaf(): boolean {
        return this.getType() !== ElementType.FOLDER;
    }
}
