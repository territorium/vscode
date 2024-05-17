'use strict';

import * as vscode from "vscode";
import * as path from "path";

import { Server } from "./Server";


export class ServerTreeFile extends vscode.TreeItem {

    constructor(public filename: string, public tooltip: string, public iconPath: { dark: string, light: string },  private _server: Server, type?: string) {
        super(path.basename(filename));
        this.contextValue = type ?? 'toml';
    }

    public getServer(): Server {
        return this._server;
    }
}