'use strict';

import * as vscode from "vscode";
import * as path from "path";

import * as fs from "fs";
import * as fse from "fs-extra";

// tslint:disable-next-line:no-require-imports
import { MessageItem } from "vscode";

import { DialogMessage } from '../util/DialogMessage';

import { ServerModel } from "./ServerModel";
import { Server } from "./Server";


export class ServerController {

    private _outputChannel: vscode.OutputChannel;

    constructor(private _model: ServerModel, private _context: vscode.ExtensionContext) {
        this._outputChannel = vscode.window.createOutputChannel('vscode-tol');
    }

    async validateInstallPath(installPath: string): Promise<boolean> {
        const configFileExists = await fse.pathExists(path.join(installPath, 'conf', 'server.properties'));
        const loggingFileExists = await fse.pathExists(path.join(installPath, 'conf', 'logging.properties'));
        const odbConfigFileExists = await fse.pathExists(path.join(installPath, 'bin', 'odb-server.properties'));
        const odbLoggingFileExists = await fse.pathExists(path.join(installPath, 'bin', 'odb-logging.properties'));
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
                const installPath: string = pathPicker[i].fsPath;
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
                canSelectFiles: true,
                canSelectFolders: false,
                openLabel: "Select a Model",
                filters: {
                    'Configuration': ['properties']
                }
            });

            if (pathPicker) {
                this._model.setModelPath(server, path.parse(pathPicker[0].fsPath).dir);
            }
        }
    }

    public async startServer(server: Server, debug?: boolean): Promise<void> {
        if (server) {
            if (server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverRunning);
                return;
            }

            server.setDebugPort(debug ? 8004 : -1),
                await this.startInternally(server);
        }
    }

    public async stopOrRestartServer(server: Server, restart: boolean = false): Promise<void> {
        if (server) {
            if (!server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverStopped);
                return;
            }

            await server.stop(this._outputChannel);

            if (restart) {
                await this.startInternally(server);
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

    private async startInternally(server: Server): Promise<void> {
        const serverConfig: string = server.getConfigPath();

        let watcher = fs.watch(serverConfig);
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

            const process = server.start(this._outputChannel);
            server.setStarted(true);
            this.startDebugSession(server);
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

    private startDebugSession(server: Server): void {
        let uri = vscode.Uri.parse("/data/smartIO/release2504/server");
        let workspaceFolder: vscode.WorkspaceFolder | undefined;
        if (vscode.workspace.workspaceFolders) {
            workspaceFolder = vscode.workspace.workspaceFolders.find((f: vscode.WorkspaceFolder): boolean => {
                console.log("Workspace Folder", f.name, f.uri);
                const relativePath: string = path.relative(f.uri.fsPath, uri.fsPath);
                return relativePath === '' || (!relativePath.startsWith('..') && relativePath !== uri.fsPath);
            });
        }

        if (!server.isDebugging() || !workspaceFolder) {
            return;
        }
        const config = server.getDebugConfiguration();
        if (config) {
            setTimeout(() => vscode.debug.startDebugging(workspaceFolder, config), 500);
        }
    }

    public dispose(): void {
        this._model.getServerList().forEach((element: Server) => {
            if (element.isStarted()) {
                this.stopOrRestartServer(element);
            }
            this._outputChannel.dispose();
        });
        this._model.saveServerListSync();
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

    // /* tslint:disable:no-any */
    // private async determineAppName(webappPath: string, item: ServerTreeItem): Promise<string> {
    //     const defaultName: string = path.basename(webappPath, path.extname(webappPath));
    //     let appName: string = defaultName;
    //     let folderLocation: string;
    //     if (this.isWarFile(webappPath)) {
    //         folderLocation = path.join(this._model.defaultStoragePath, defaultName);
    //         await fse.remove(folderLocation);
    //         await fse.mkdir(folderLocation);
    //         await ProcessBuilder.execute(this._outputChannel, item.getServer().getName(), 'jar', { cwd: folderLocation }, 'xvf', `${webappPath}`);
    //     } else {
    //         folderLocation = webappPath;
    //     }
    //     return appName;
    // }
    // /* tsline:enable:no-any */

    // private parseContextPathToFolderName(context: string): string {
    //     if (context === '/' || context === '') {
    //         return 'ROOT';
    //     }
    //     const replacedSlashes: string = context.replace('/', '#');
    //     return replacedSlashes.startsWith('#') ? replacedSlashes.substring(1) : replacedSlashes;
    // }
}
