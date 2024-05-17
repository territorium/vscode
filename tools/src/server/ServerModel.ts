'use strict';

import * as path from "path";
import * as vscode from "vscode";

import { Server, ServerPlatform, ServerOQL, DEBUG_SESSION_NAME } from "./Server";

import * as fse from "fs-extra";
import * as dash from "lodash";

class ModelConfig {

    constructor(public _name: string, public _installPath: string,
        public _storagePath: string, public _type: string, public _model?: string) {
    }
}

export class ServerModel {

    private _serverList: Server[] = [];

    private _serverConfig: string;

    constructor(public defaultStoragePath: string, context: vscode.ExtensionContext) {
        this._serverConfig = path.join(defaultStoragePath, 'servers.json');

        this.initServerListSync(context);

        vscode.debug.onDidTerminateDebugSession((session: vscode.DebugSession) => {
            if (session && session.name && session.name.startsWith(DEBUG_SESSION_NAME)) {
                console.log("Debugging session terminated", session.name.split('_')?.pop());
            }
        });
    }

    public getServerList(): Server[] {
        return this._serverList;
    }

    public getServerByName(serverName: string): Server | undefined {
        return this._serverList.find((item: Server) => item.getName() === serverName);
    }

    public deleteServer(server: Server): boolean {
        const index: number = this._serverList.findIndex((item: Server) => item.getName() === server.getName());
        if (index > -1) {
            const oldServer: Server[] = this._serverList.splice(index, 1);
            if (!dash.isEmpty(oldServer)) {
                fse.remove(server.getStoragePath());
                this.saveServerListSync();

                vscode.commands.executeCommand('tol.refreshServerView');
                return true;
            }
        }

        return false;
    }

    public addServer(server: Server): void {
        const index: number = this._serverList.findIndex((item: Server) => item.getName() === server.getName());
        if (index > -1) {
            this._serverList.splice(index, 1);
        }
        this._serverList.push(server);
        this.saveServerListSync();

        vscode.commands.executeCommand('tol.refreshServerView');
    }

    public saveServerListSync(): void {
        try {
            fse.outputJsonSync(this._serverConfig, this._serverList.map((s: Server) => {
                return new ModelConfig(s.getName(), s.getInstallPath(), s.getStoragePath(), s.getType(), s.modelLocation);
            }));
        } catch (err : any) {
            console.error(err.toString());
        }
    }

    private initServerListSync(context: vscode.ExtensionContext): void {
        try {
            if (fse.existsSync(this._serverConfig)) {
                const objArray: ModelConfig[] = fse.readJsonSync(this._serverConfig);
                if (!dash.isEmpty(objArray)) {
                    this._serverList = this._serverList.concat(objArray.map(
                        obj => {
                            return (obj._type === "server") ? new ServerOQL(obj._name, obj._installPath, obj._storagePath)
                                : new ServerPlatform(obj._name, obj._installPath, obj._storagePath, obj._model);
                        }));
                }
            }
        } catch (err) {
            console.error(err);
        }
    }
}
