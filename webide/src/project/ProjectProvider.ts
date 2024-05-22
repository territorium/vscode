'use strict';

import * as vscode from "vscode";
import * as path from "path";

import { TreeItem } from "vscode";

import { Utility } from "../util/Utility";
import { ProjectModel } from "./ProjectModel";
import { ProjectNode, FileTreeItem } from "./Project";


export class ProjectTreeItem extends TreeItem {


    constructor(private element: ProjectNode, collapsibleState?: vscode.TreeItemCollapsibleState) {
        super(element.getName(), collapsibleState);
    }

    public getNode(): ProjectNode {
        return this.element;
    }
}


export class ProjectProvider implements vscode.TreeDataProvider<ProjectNode> {

    private readonly _onDidChangeTreeData: vscode.EventEmitter<ProjectNode> = new vscode.EventEmitter<ProjectNode>();
    readonly onDidChangeTreeData: vscode.Event<ProjectNode> = this._onDidChangeTreeData.event;


    constructor(private _model: ProjectModel, private _context: vscode.ExtensionContext) {
        // this._onDidChangeTreeData.fire();
        _context.subscriptions.push(vscode.commands.registerCommand('tol.openProjectFile', item => this.onClicked(item)));
        _context.subscriptions.push(vscode.commands.registerCommand('tol.refreshProjectView', (_operationId: string, item: ProjectTreeItem) => this.refresh(item)));
    }

    public async getTreeItem(element: ProjectNode): Promise<ProjectTreeItem> {
        const item = new ProjectTreeItem(element);
        item.contextValue = element.getType();
        item.collapsibleState = (await element.getChildren()).length === 0 ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed;

        switch (element.getType()) {
            case "project":
                item.iconPath = this.toIconPath('symbol-method.svg');
                break;

            case "model":
                item.iconPath = this.toIconPath('archive.svg');
                break;

            case "folder":
                item.iconPath = this.toIconPath('folder.svg');
                break;

            case "file":
                const title: string = item.label?.toString() ?? "";
                item.command = { command: 'tol.openProjectFile', title: title, arguments: [element] };

                item.iconPath = this.toIconPath('file.svg');
                break;
        }

        return item;
    }

    public refresh(item: ProjectTreeItem): void {
        this._onDidChangeTreeData.fire(item?.getNode());
    }

    public async getChildren(element?: ProjectNode): Promise<ProjectNode[]> {
        return element ? element.getChildren() : this._model.getList();
    }

    public onClicked(item: FileTreeItem) {
        if (item.file === undefined) {
            return;
        }

        Utility.openFile(item.file);
    }

    public dispose(): void {
        this._onDidChangeTreeData.dispose();
    }

    private toIconPath(file: string): {
        light: string;
        dark: string;
    } {
        return {
            dark: this._context.asAbsolutePath(path.join('icons', 'dark', file)),
            light: this._context.asAbsolutePath(path.join('icons', 'light', file))
        };
    }
}
