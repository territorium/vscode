'use strict';

import * as vscode from "vscode";
import * as path from "path";
import * as fse from "fs-extra";

import { Workspace } from "../util/Workspace";
import { Server, ServerPlatform, ServerOQL, IS_WINDOWS, DEBUG_SESSION_NAME } from "./Server";


class ModelConfig {

    constructor(public _name: string, public _installPath: string,
        public _storagePath: string, public _type: string, public _model?: string) {
    }
}

export class ServerModel {

    private _config: string;
    private _serverList: Server[];

    constructor(public defaultStoragePath: string, private context: vscode.ExtensionContext) {
        this._config = path.join(defaultStoragePath, 'servers.json');
        this._serverList = [];

        this.loadServerList(context);

        vscode.debug.onDidTerminateDebugSession((session: vscode.DebugSession) => {
            if (session && session.name && session.name.startsWith(DEBUG_SESSION_NAME)) {
                console.log("Debugging session terminated", session.name.split('_')?.pop());
            }
        });
    }

    public getServerList(): Server[] {
        return this._serverList;
    }

    public setModelPath(server: Server, location: string) {
        (<ServerPlatform>server).setModel(location);
        this.saveServerListSync();
        vscode.commands.executeCommand('tol.refreshServerView');
    }

    public getServerByName(serverName: string): Server | undefined {
        return this._serverList.find((item: Server) => item.getName() === serverName);
    }

    public deleteServer(server: Server): boolean {
        const index: number = this._serverList.findIndex((item: Server) => item.getName() === server.getName());
        if (index > -1) {
            const oldServer = this._serverList.splice(index, 1);
            if (oldServer.length > 0) {
                fse.remove(server.getStoragePath());
                this.saveServerListSync();

                vscode.commands.executeCommand('tol.refreshServerView');
                return true;
            }
        }

        return false;
    }

    public async addServerPath(installPath: string): Promise<void> {
        const existingServerNames: string[] = this.getServerList().map((item: Server) => { return item.getName(); });
        const serverName: string = await Workspace.getServerName(installPath, this.defaultStoragePath, existingServerNames);
        const storagePath: string = await Workspace.getStoragePath(this.defaultStoragePath, serverName);
        fse.remove(storagePath);

        if (await fse.pathExists(path.join(installPath, "bin", "smartIO" + (IS_WINDOWS ? '.exe' : '')))) {
            this.addServer(new ServerPlatform(serverName + " Platform", installPath, storagePath, this.context));
        }

        if (await fse.pathExists(path.join(installPath, "bin", "smartIO-odb" + (IS_WINDOWS ? '.exe' : '')))) {
            this.addServer(new ServerOQL(serverName + " Server", installPath, storagePath));
        }
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

    private loadServerList(context: vscode.ExtensionContext): void {
        try {
            if (fse.existsSync(this._config)) {
                const objArray: ModelConfig[] = fse.readJsonSync(this._config);
                if (objArray.length > 0) {
                    this._serverList = this._serverList.concat(objArray.map(
                        obj => {
                            return (obj._type === "server") ? new ServerOQL(obj._name, obj._installPath, obj._storagePath)
                                : new ServerPlatform(obj._name, obj._installPath, obj._storagePath, context, obj._model);
                        }));
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    public saveServerListSync(): void {
        try {
            fse.outputJsonSync(this._config, this._serverList.map((s: Server) => {
                return new ModelConfig(s.getName(), s.getInstallPath(), s.getStoragePath(), s.getType(), s.modelLocation);
            }));
        } catch (err: any) {
            console.error(err.toString());
        }
    }
}
