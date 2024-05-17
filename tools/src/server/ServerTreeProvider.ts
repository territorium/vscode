'use strict';

import * as vscode from "vscode";
import * as path from "path";
import * as fse from "fs-extra";

import { TreeItem } from "vscode";

import { Utility } from "../util/Utility";
import { Server, ServerState } from "./Server";
import { ServerModel } from "./ServerModel";
import { ServerTreeModel } from "./ServerTreeModel";
import { ServerTreeFile } from "./ServerTreeFile";


export class ServerTreeItem extends vscode.TreeItem {

    constructor(private server: Server, label: string, icon: string, context: vscode.ExtensionContext) {
        super(label);
        this.iconPath = {
            dark: vscode.Uri.parse(context.asAbsolutePath(path.join('icons', 'dark', icon))),
            light: vscode.Uri.parse(context.asAbsolutePath(path.join('icons', 'light', icon)))
        };
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
        if (element.contextValue === "toml" || element.contextValue === "jvm") {
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
                const item = new ServerTreeItem(server, server.getName(), `${server.getIcon()}.svg`, this._context);
                item.contextValue = server.getState();
                item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                return item;
            });
        } else if (element.contextValue === ServerState.IdleServer || element.contextValue === ServerState.RunningServer) {
            const server: ServerTreeItem = <ServerTreeItem>element;

            const webapps: string = path.join(server.getServer().getStoragePath(), 'webapps');
            if (await fse.pathExists(webapps)) {
                const wars: string[] = [];
                let temp: fse.Stats;
                let fileExtension: string;
                // show war packages with no extension if there is one
                // and no need to show war packages if its unzipped folder exists
                const promises: Promise<void>[] = (await fse.readdir(webapps)).map(async (w: string) => {
                    if (w.toUpperCase() !== 'ROOT') {
                        temp = await fse.stat(path.join(webapps, w));
                        fileExtension = path.extname(path.join(webapps, w));
                        if (temp.isDirectory() || (temp.isFile() && fileExtension === '.war')) {
                            wars.push(fileExtension === '.war' ? path.basename(w, fileExtension) : w);
                        }
                    }
                });
                await Promise.all(promises);
                // tslint:disable-next-line:underscore-consistent-invocation
                return [];
            }

            return server.getServer().getChildren(this._context);
        } else if (element.contextValue === "model") {
            const model: ServerTreeModel = <ServerTreeModel>element;

            return model.getServer().getModelChildren(this._context);
        }
        return [];
    }

    public onClicked(item: ServerTreeFile) {
        if (item.filename === undefined) {
            return;
        }

        if (!fse.pathExists(item.filename)) {
            const server = item.getServer();
            fse.copy(path.join(this._context.extensionPath, 'resources', 'jvm.options'), path.join(server.getStoragePath(), 'jvm.options'));
        }

        Utility.openFile(item.filename);
    }

    public dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}
