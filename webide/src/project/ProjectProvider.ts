'use strict';

import * as vscode from "vscode";

import { TreeItem } from "vscode";

import { ProjectModel } from "./ProjectModel";
import { ProjectNode, FileTreeItem, ElementType } from "./Project";
import { Utility } from "../util/Utility";


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
        _context.subscriptions.push(vscode.commands.registerCommand('tol.addEntry', item => vscode.window.showInformationMessage(`Successfully called add entry.`)));
    }

    public async getTreeItem(element: ProjectNode): Promise<ProjectTreeItem> {
        const item = new ProjectTreeItem(element);
        item.contextValue = element.getType().toString();
        item.collapsibleState = (await element.getChildren()).length === 0 ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed;

        switch (element.getType()) {
            case ElementType.PROJECT:
                item.iconPath = Utility.toIconPath('package.svg', this._context);
                break;

            case ElementType.MODEL:
                item.iconPath = Utility.toIconPath('archive.svg', this._context);
                break;

            case ElementType.FOLDER:
                item.iconPath = Utility.toIconPath('folder.svg', this._context);
                break;

            case ElementType.FILE:
                const title: string = item.label?.toString() ?? "";
                item.command = { command: 'tol.openProjectFile', title: title, arguments: [element] };

                item.iconPath = Utility.toIconPath('file.svg', this._context);
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
        if (item.isLeaf()) {
            Utility.openUri(item.getUri());
        }

    }

    public dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}
