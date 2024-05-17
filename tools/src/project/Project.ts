'use strict';

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { opendir } from 'fs/promises';

import { TOML, Parameter } from "../util/Toml";


export class ProjectNode {

    constructor(private name: string, private type: string,) {
    }

    public getName(): string {
        return this.name;
    }

    public getType(): string {
        return this.type;
    }

    public async getChildren(): Promise<ProjectNode[]> {
        return [];
    }
}


export class Project extends ProjectNode {

    private config: string;

    constructor(private folder: vscode.WorkspaceFolder) {
        super(folder.name, "project");
        const p1 = path.join(this.folder.uri.path, "context.properties");
        const p2 = path.join(this.folder.uri.path, "smartIO", "context.properties");
        this.config = fs.existsSync(p1) ? p1 : p2;
    }

    public async getChildren(): Promise<ProjectNode[]> {
        const toml = await TOML.read(this.config);
        const list = toml.keys().filter(k => k.startsWith("model.")) ?? [];
        list.map(n => {
            return n;
        });
        return toml.keys().filter(k => k.startsWith("model.")).map(k => new ModelTreeItem(k.substring(6), this.config, toml.get(k))) ?? [];
    }
}

export class ModelTreeItem extends ProjectNode {

    private path: string;

    constructor(name: string, config: string, private parameter: Parameter) {
        super(name, "model");
        this.path = path.join(path.dirname(config), parameter["path"] ?? name);
    }

    public async getChildren(): Promise<ProjectNode[]> {
        try {
            const children: ProjectNode[] = [];
            const dir = await opendir(this.path);
            for await (const e of dir) { children.push(new FileTreeItem(e.path)); }
            return children;
        } catch (err) {
            console.error(err);
        }
        return [];
    }
}

export class FileTreeItem extends ProjectNode {

    constructor(public file: string) {
        super(path.basename(file), file.indexOf(".") < 0 ? "folder" : "file");
    }

    public async getChildren(): Promise<ProjectNode[]> {
        if (this.file.indexOf(".") < 0) {
            try {
                const children: ProjectNode[] = [];
                const dir = await opendir(this.file);
                for await (const e of dir) { children.push(new FileTreeItem(e.path)); }
                return children;
            } catch (err) {
                console.error(err);
            }
        }
        return [];
    }
}
