'use strict';

import * as vscode from "vscode";
import * as path from "path";

import { TreeItem } from "vscode";

import { Utility } from "../util/Utility";
import { Defaults } from "../default";
import { ServerModel } from "./ServerModel";
import { Server, ServerState } from "./Server";


export class ServerTreeItem extends vscode.TreeItem {

    constructor(private server: Server) {
        super(server.getTitle());
    }

    public getServer(): Server {
        return this.server;
    }
}


export class ServerTreeProvider implements vscode.TreeDataProvider<TreeItem> {

    private readonly _onDidChangeTreeData: vscode.EventEmitter<TreeItem> = new vscode.EventEmitter<TreeItem>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem> = this._onDidChangeTreeData.event;


    constructor(private _model: ServerModel, private _context: vscode.ExtensionContext) {
        _context.subscriptions.push(vscode.commands.registerCommand('tol.openServerFile', item => this.onClicked(item)));
        _context.subscriptions.push(vscode.commands.registerCommand('tol.refreshServerView', (_operationId: string, server: ServerTreeItem) => this.refresh(server)));
    }

    public async getTreeItem(element: TreeItem): Promise<TreeItem> {
        return element;
    }

    public resolveTreeItem?(item: TreeItem, element: TreeItem, token: vscode.CancellationToken): vscode.ProviderResult<TreeItem> {
        if (element.contextValue === Defaults.TYPE_INI || element.contextValue === Defaults.TYPE_JVM) {
            const title: string = element.label?.toString() ?? "";
            element.command = { command: 'tol.openServerFile', title: title, arguments: [element] };
        }
        return item;
    }

    public refresh(element: TreeItem): void {
        this._onDidChangeTreeData.fire(element);
    }

    public async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (!element) {
            return this._model.getServerList().map((server: Server) => {
                const item = new ServerTreeItem(server);
                item.contextValue = server.getState();
                item.iconPath = Utility.toIconPath(`${server.getIcon()}.svg`, this._context);
                item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                return item;
            });
        }

        const children: TreeItem[] = [];
        switch (element.contextValue) {
            case "model": const model = <ServerTreeItem>element;
                const location = model.getServer().getUserDir();
                if (location) {
                    model.getServer().getUserFiles().forEach(i => {
                        const node = new TreeItem(i);
                        node.label = path.basename(i.fsPath);
                        node.contextValue = Defaults.TYPE_INI;
                        node.iconPath = Utility.toIconPath('settings-gear.svg', this._context);
                        children.push(node);
                    });
                }
                break;

            case ServerState.IdleServer:
            case ServerState.RunningServer:
                const server: Server = (<ServerTreeItem>element).getServer();
                server.getFiles().forEach(i => {
                    const node = new TreeItem(i);
                    node.label = path.basename(i.fsPath);
                    node.contextValue = Defaults.TYPE_INI;
                    node.iconPath = Utility.toIconPath('settings-gear.svg', this._context);

                    if (i.fsPath.endsWith("jvm.options")) {
                        node.contextValue = Defaults.TYPE_JVM;
                        node.iconPath = Utility.toIconPath('symbol-namespace.svg', this._context);
                    }

                    children.push(node);
                });

                if (server.getUserFiles().length && (server.getType() === "platform" || server.getType() === "server" || server.getType() === "cli")) {
                    const node = new ServerTreeItem(server);
                    node.label = path.basename(server.getUserDir()?.fsPath || "");
                    node.contextValue = "model";
                    node.iconPath = Utility.toIconPath('package.svg', this._context);
                    node.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                    children.push(node);
                }
                break;
        }
        return children;
    }

    public onClicked(item: TreeItem) {
        if (item.resourceUri === undefined) {
            return;
        }

        if (item.contextValue === Defaults.TYPE_JVM || item.contextValue === Defaults.TYPE_INI) {
            Utility.openUri(item.resourceUri);
        }
    }

    public dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}
