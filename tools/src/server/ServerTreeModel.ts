'use strict';

import * as vscode from "vscode";
import * as path from "path";

import { ServerPlatform } from "./Server";


export class ServerTreeModel extends vscode.TreeItem {

    public path?: string;

    constructor(public tooltip: string, public iconPath: { dark: string, light: string }, private _server: ServerPlatform, location?: string) {
        super(location ? path.basename(location) : "<Select Model>");
        this.path = location;
        this.contextValue = 'model';
        this.collapsibleState = location ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
    }

    public getServer(): ServerPlatform {
        return this._server;
    }
}