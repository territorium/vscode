'use strict';

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import { Workspace } from "../util/Workspace";

import { Server, newInstance, IS_WINDOWS, DEBUG_SESSION_NAME } from "./Server";


class ModelConfig {

    public _name: string;
    public _installPath: string;
    public _storagePath: string;
    public _type: string;
    public _model?: string;

    constructor(s: Server) {
        this._name = s.getName();
        this._installPath = s.getInstallPath().fsPath;
        this._storagePath = s.getStoragePath().fsPath;
        this._type = s.getType();
        this._model = s.getUserDir()?.fsPath;
    }

    public static create(config: ModelConfig): Server {
        const userDir = config._model ? vscode.Uri.parse(config._model) : undefined;
        return newInstance(config._name, config._type, vscode.Uri.parse(config._installPath), vscode.Uri.parse(config._storagePath), userDir);
    }
}

export class ServerModel {

    private _serverList: Server[];

    constructor(private uri: vscode.Uri, private context: vscode.ExtensionContext) {
        this._serverList = [];

        this.loadServerList();

        vscode.debug.onDidTerminateDebugSession((session: vscode.DebugSession) => {
            if (session && session.name && session.name.startsWith(DEBUG_SESSION_NAME)) {
                console.log("Debugging session terminated", session.name.split('_')?.pop());
            }
        });
    }

    public getServerList(): Server[] {
        return this._serverList;
    }

    public dispose() {
        this._serverList.forEach(s => s.dispose());
    }

    public setModelPath(server: Server, userDir?: vscode.Uri) {
        server.setUserDir(userDir);
        this.saveServerListSync();
        vscode.commands.executeCommand('tol.refreshServerView');
    }

    public deleteServer(server: Server): boolean {
        const index: number = this._serverList.findIndex((item: Server) => item.getName() === server.getName());
        if (index > -1) {
            const oldServer = this._serverList.splice(index, 1);
            if (oldServer.length > 0) {
                Workspace.removeDir(server.getStoragePath());
                this.saveServerListSync();

                vscode.commands.executeCommand('tol.refreshServerView');
                return true;
            }
        }

        return false;
    }

    public async addServerPath(installPath: vscode.Uri): Promise<void> {
        const existingServerNames: string[] = this.getServerList().map((item: Server) => { return item.getName(); });
        const workspace = Workspace.getWorkspace(this.uri);
        const fileNames: string[] = await Workspace.readFileNames(workspace);
        let serverName: string = path.basename(installPath.fsPath);
        let index: number = 1;
        while (fileNames.indexOf(serverName) >= 0 || existingServerNames.indexOf(serverName) >= 0) {
            serverName = serverName.concat(`-${index}`);
            index += 1;
        }

        const storagePath: vscode.Uri = vscode.Uri.joinPath(workspace, serverName);
        Workspace.removeDir(storagePath);

        if (fs.existsSync(vscode.Uri.joinPath(installPath, "bin", "smartIO" + (IS_WINDOWS ? '.exe' : '')).fsPath)) {
            this.addServer(newInstance(serverName, "platform", installPath, storagePath));
        }

        if (fs.existsSync(vscode.Uri.joinPath(installPath, "bin", "smartIO-odb" + (IS_WINDOWS ? '.exe' : '')).fsPath)) {
            this.addServer(newInstance(serverName, "server", installPath, storagePath));
        }

        if (fs.existsSync(vscode.Uri.joinPath(installPath, "bin", "smartio-cli" + (IS_WINDOWS ? '.exe' : '')).fsPath)) {
            this.addServer(newInstance(serverName, "cli", installPath, storagePath));
        }
    }

    public addServer(server: Server): void {
        const index: number = this._serverList.findIndex((item: Server) => item.getName() === server.getTitle());
        if (index > -1) {
            this._serverList.splice(index, 1);
        }
        this._serverList.push(server);
        this.saveServerListSync();

        vscode.commands.executeCommand('tol.refreshServerView');
    }

    private loadServerList(): void {
        const config = vscode.Uri.joinPath(this.uri, 'servers.json');
        this._serverList = Workspace.loadList(config.fsPath).map(o => ModelConfig.create(o));
    }

    public saveServerListSync(): void {
        const config = vscode.Uri.joinPath(this.uri, 'servers.json');
        Workspace.saveList(config.fsPath, this._serverList.map(i => new ModelConfig(i)));
    }
}
