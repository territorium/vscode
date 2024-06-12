'use strict';

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import { MessageItem } from "vscode";

import { Defaults } from '../default';
import { DialogMessage } from '../util/DialogMessage';

import { ServerModel } from "./ServerModel";
import { Server } from "./Server";


export class ServerController {

    constructor(private _model: ServerModel, private _context: vscode.ExtensionContext) {
    }

    async validateInstallPath(installPath: vscode.Uri): Promise<boolean> {
        const configFileExists = fs.existsSync(vscode.Uri.joinPath(installPath, 'conf', 'server.properties').fsPath);
        const loggingFileExists = fs.existsSync(vscode.Uri.joinPath(installPath, 'conf', 'logging.properties').fsPath);
        const odbConfigFileExists = fs.existsSync(vscode.Uri.joinPath(installPath, 'bin', 'odb-server.properties').fsPath);
        const odbLoggingFileExists = fs.existsSync(vscode.Uri.joinPath(installPath, 'bin', 'odb-logging.properties').fsPath);
        return (configFileExists && loggingFileExists) || (odbConfigFileExists && odbLoggingFileExists);
    }

    public async addServer(): Promise<void> {
        const pathPicker = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: DialogMessage.selectDirectory,
            title: "Select Installation Directory"
            // defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined
        });

        if (pathPicker) {
            for (let i = 0; i < pathPicker.length; i++) {
                const installPath = pathPicker[i];
                if (!this.validateInstallPath(installPath)) {
                    vscode.window.showErrorMessage("Invalid Server Directory");
                    return;
                }

                this._model.addServerPath(installPath);
            };
        }
    }

    public async deleteServer(server: Server): Promise<void> {
        if (server) {
            const confirmation: MessageItem | undefined = await vscode.window.showWarningMessage(DialogMessage.deleteConfirm, DialogMessage.yes, DialogMessage.cancel);
            if (confirmation !== DialogMessage.yes) {
                return;
            }
            if (server.isStarted()) {
                await this.stopOrRestartServer(server);
            }
            this._model.deleteServer(server);
        }
    }

    public async selectModel(server: Server): Promise<void> {
        if (server) {
            const pathPicker: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
                defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
                openLabel: "Select a Project Folder",
                canSelectFiles: false,
                canSelectFolders: true
                // filters: {
                //     'Configuration': ['properties']
                // }
            });

            if (pathPicker) {
                this._model.setModelPath(server, pathPicker[0]);
            }
        }
    }

    public async removeModel(server: Server): Promise<void> {
        if (server) {
            this._model.setModelPath(server, undefined);
        }
    }

    public async startServer(server: Server, debug?: boolean): Promise<void> {
        if (server) {
            if (server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverRunning);
                return;
            }

            await this.startInternally(server, debug);
        }
    }

    public async stopOrRestartServer(server: Server, restart: boolean = false): Promise<void> {
        if (server) {
            if (!server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverStopped);
                return;
            }

            await server.stop();

            if (restart) {
                await this.startInternally(server, server.isDebugging());
            }
        }
    }

    public async openExternal(server: Server, resource: string): Promise<void> {
        if (server) {
            if (!server.isStarted()) {
                const result: MessageItem | undefined = await vscode.window.showInformationMessage(DialogMessage.startServer, DialogMessage.yes, DialogMessage.cancel);
                if (result !== DialogMessage.yes) {
                    return;
                }
                this.startServer(server);
            }
            // const httpPort: string = await Utility.getPort(item.getServerConfigPath(), Constants.PortKind.Http);
            // vscode.env.openExternal(vscode.Uri.parse(`${Constants.LOCALHOST}:${httpPort}`));
            vscode.env.openExternal(vscode.Uri.parse(resource));
        }
    }

    private async startInternally(server: Server, debug?: boolean): Promise<void> {
        const serverConfig = server.getConfigPath();

        // CHECK for debugging
        let workspaceFolder: vscode.WorkspaceFolder | undefined;
        if (vscode.workspace.workspaceFolders) {
            const found = (vscode.workspace.workspaceFolders.length === 1);
            workspaceFolder = found ? vscode.workspace.workspaceFolders[0] : await vscode.window.showWorkspaceFolderPick();
        }

        if (debug && !workspaceFolder) {
            vscode.window.showInformationMessage("No workspace found! Starting without debugging!");
        }

        server.setDebugPort(debug && workspaceFolder ? 8004 : -1);
        // CHECK for debugging

        let watcher = fs.watch(serverConfig.fsPath);
        try {
            watcher.on('change', async () => {
                //     if (serverPort !== await Utility.getPort(serverConfig, Constants.PortKind.Server)) {
                //         const result: MessageItem = await vscode.window.showErrorMessage(
                //             DialogMessage.getServerPortChangeErrorMessage(serverName, serverPort), DialogMessage.yes, DialogMessage.no, DialogMessage.moreInfo
                //         );

                //         if (result === DialogMessage.yes) {
                //             await Utility.setPort(serverConfig, Constants.PortKind.Server, serverPort);
                //         } else if (result === DialogMessage.moreInfo) {
                //             opn(Constants.UNABLE_SHUTDOWN_URL);
                //         }
                //     } else if (await Utility.needRestart(httpPort, httpsPort, serverConfig)) {
                //         const item: MessageItem = await vscode.window.showWarningMessage(
                //             DialogMessage.getConfigChangedMessage(serverName), DialogMessage.yes, DialogMessage.no, DialogMessage.never
                //         );

                //         if (item === DialogMessage.yes) {
                //             await this.stopOrRestartServer(serverInfo, true);
                //         } else if (item === DialogMessage.never) {
                //             Utility.disableAutoRestart();
                //         }
                //     }
            });

            const process = server.start();
            server.setStarted(true);

            // START debugging
            if (server.isDebugging() && workspaceFolder) {
                const config = server.getDebugConfiguration();
                if (config) {
                    vscode.debug.stopDebugging();
                    setTimeout(() => vscode.debug.startDebugging(workspaceFolder, config), 500);
                }
            }

            // END debugging

            await process;
        } catch (err: any) {
            vscode.window.showErrorMessage(err.toString());
        } finally {
            server.setStarted(false);
            if (watcher) {
                watcher.close();
            }
        }
    }

    public dispose(): void {
        this._model.getServerList().forEach((element: Server) => {
            if (element.isStarted()) {
                this.stopOrRestartServer(element);
            }
        });
        this._model.saveServerListSync();
        this._model.dispose();
    }

    // public async runOrDebugOnServer(debug?: boolean, server?: ServerTreeItem): Promise<void> {
    //     const dialog: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
    //         defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
    //         canSelectFiles: true,
    //         canSelectFolders: false,
    //         openLabel: DialogMessage.selectWarPackage
    //     });
    //     if (isEmpty(dialog) || !dialog || !dialog[0].fsPath) {
    //         return;
    //     }
    //     let uri = dialog[0];

    //     if (!server) {
    //         return;
    //     }
    //     await this.deployWebapp(server, uri.fsPath);
    //     if (server.getServer().isStarted() && ((!server.getServer().isDebugging() && !debug) || server.getServer().isDebugging() === debug)) {
    //         return;
    //     }
    //     if (server.getServer().isStarted()) {
    //         await this.stopOrRestartServer(server.getServer(), true);
    //     } else {
    //         await this.startInternally(server);
    //     }
    // }

    // public async generateWarPackage(): Promise<void> {
    //     const folders = vscode.workspace.workspaceFolders;
    //     if (folders && folders.length > 0) {
    //         let items: vscode.QuickPickItem[] | undefined = [];
    //         if (folders.length > 1) {
    //             items = await vscode.window.showQuickPick(
    //                 folders.map((w: vscode.WorkspaceFolder) => {
    //                     return { label: w.name, description: w.uri.fsPath };
    //                 }),
    //                 { placeHolder: DialogMessage.pickFolderToGenerateWar, canPickMany: true }
    //             );
    //         } else {
    //             items.push({
    //                 label: folders[0].name,
    //                 description: folders[0].uri.fsPath
    //             });
    //         }

    //         if (items) {
    //             await Promise.all(items.map((i: vscode.QuickPickItem) => {
    //                 return ProcessBuilder.execute(this._outputChannel, "", 'jar', { cwd: i.description, shell: true }, 'cvf', ...[`"${i.label}.war"`, '*']);
    //             }));
    //             vscode.window.showInformationMessage(DialogMessage.getWarGeneratedInfo(items.length));
    //         }
    //     }
    // }

    // private async deployWebapp(item: ServerTreeItem, webappPath: string): Promise<void> {
    //     if (!item || !await fse.pathExists(webappPath)) {
    //         return;
    //     }
    //     const appName: string = await this.determineAppName(webappPath, item);
    //     const appPath: string = path.join(item.getServer().getStoragePath(), 'webapps', appName);

    //     await fse.remove(appPath);
    //     await fse.mkdirs(appPath);
    //     if (this.isWarFile(webappPath)) {
    //         await ProcessBuilder.execute(this._outputChannel, item.getServer().getName(), 'jar', { cwd: appPath }, 'xvf', `${webappPath}`);
    //     } else {
    //         await fse.copy(webappPath, appPath);
    //     }
    //     vscode.commands.executeCommand('tol.refreshServerView');
    // }

    // private isWarFile(filePath: string): boolean {
    //     return path.extname(filePath).toLocaleLowerCase() === '.war';
    // }
}
