'use strict';

import * as vscode from "vscode";
import * as path from "path";

import * as fs from "fs";
import * as fse from "fs-extra";

import { isEmpty } from "lodash";

// tslint:disable-next-line:no-require-imports
import { MessageItem } from "vscode";

import { DialogMessage } from '../util/DialogMessage';

import { ServerModel } from "./ServerModel";
import { ServerTreeItem } from "./ServerTreeProvider";
import { Server, ServerOQL, ServerPlatform, IS_WINDOWS } from "./Server";

import { Workspace } from "../util/Workspace";
import { ProcessBuilder } from "../util/ProcessBuilder";
import { ServerTreeModel } from "./ServerTreeModel";


export class ServerController {

    private _outputChannel: vscode.OutputChannel;

    constructor(private _model: ServerModel) {
        this._outputChannel = vscode.window.createOutputChannel('vscode-tol');
    }

    async validateInstallPath(installPath: string): Promise<boolean> {
        const configFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'conf', 'server.properties'));
        const loggingFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'conf', 'logging.properties'));
        const odbConfigFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'bin', 'odb-server.properties'));
        const odbLoggingFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'bin', 'odb-logging.properties'));

        return await configFileExists && await loggingFileExists || (await odbConfigFileExists && await odbLoggingFileExists);
    }

    public async addServer(): Promise<void> {
        const pathPicker: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
            defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: DialogMessage.selectDirectory,
            title: "Select Installation Directory"
        });

        if (pathPicker) {
            for (let i = 0; i < pathPicker.length; i++) {
                const installPath: string = pathPicker[i].fsPath;
                if (!this.validateInstallPath(installPath)) {
                    vscode.window.showErrorMessage("Invalid Server Directory");
                    return;
                }

                const existingServerNames: string[] = this._model.getServerList().map((item: Server) => { return item.getName(); });
                const serverName: string = await Workspace.getServerName(installPath, this._model.defaultStoragePath, existingServerNames);
                const storagePath: string = await Workspace.getStoragePath(this._model.defaultStoragePath, serverName);
                fse.remove(storagePath);

                if (await fse.pathExists(path.join(installPath, "bin", "smartIO" + (IS_WINDOWS ? '.exe' : '')))) {
                    this._model.addServer(new ServerPlatform(serverName + " Platform", installPath, storagePath));
                }

                if (await fse.pathExists(path.join(installPath, "bin", "smartIO-odb" + (IS_WINDOWS ? '.exe' : '')))) {
                    this._model.addServer(new ServerOQL(serverName + " Server", installPath, storagePath));
                }
            };
        }
    }

    public async deleteServer(item: ServerTreeItem): Promise<void> {
        const server: Server | null = await this.precheck(item.getServer());
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

    public async selectModel(item: ServerTreeModel): Promise<void> {
        if (item) {
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
                const location = path.parse(pathPicker[0].fsPath).dir;
                item.getServer().setModel(location);
                vscode.commands.executeCommand('tol.refreshServerView');
            }
        }
    }

    public async stopOrRestartServer(item: Server, restart: boolean = false): Promise<void> {
        const server: Server | null = await this.precheck(item);
        if (server) {
            if (!server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverStopped);
                return;
            }

            server.needRestart = restart;
            await ProcessBuilder.execute(this._outputChannel, server.getName(), server.getCommand(), { shell: true }, ...server.getArguments('stop'));
        }
    }

    public async startServer(server: ServerTreeItem, debug?: boolean): Promise<void> {
        if (server) {
            if (server.getServer().isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverRunning);
                return;
            }
            if (debug) {
            }
            server.getServer().setDebugPort(debug ? 8004 : -1),

                await this.startInternally(server);
        }
    }

    public async openApplication(item: ServerTreeItem): Promise<void> {
        if (item) {
            if (!item.getServer().isStarted()) {
                const result: MessageItem | undefined = await vscode.window.showInformationMessage(DialogMessage.startServer, DialogMessage.yes, DialogMessage.cancel);
                if (result !== DialogMessage.yes) {
                    return;
                }
                this.startServer(item);
            }
            // const httpPort: string = await Utility.getPort(item.getServerConfigPath(), Constants.PortKind.Http);
            // vscode.env.openExternal(vscode.Uri.parse(`${Constants.LOCALHOST}:${httpPort}`));
            vscode.env.openExternal(vscode.Uri.parse("http://localhost:8080/smartio/fm"));
        }
    }

    public async openAdminPanel(item: ServerTreeItem): Promise<void> {
        if (item) {
            if (!item.getServer().isStarted()) {
                const result: MessageItem | undefined = await vscode.window.showInformationMessage(DialogMessage.startServer, DialogMessage.yes, DialogMessage.cancel);
                if (result !== DialogMessage.yes) {
                    return;
                }
                this.startServer(item);
            }
            // const httpPort: string = await Utility.getPort(item.getServerConfigPath(), Constants.PortKind.Http);
            // vscode.env.openExternal(vscode.Uri.parse(`${Constants.LOCALHOST}:${httpPort}`));
            vscode.env.openExternal(vscode.Uri.parse("http://localhost:8088"));
        }
    }

    private async startInternally(serverInfo: ServerTreeItem): Promise<void> {
        const server: Server = serverInfo.getServer();
        const serverConfig: string = server.getConfigPath();

        let watcher = fs.watch(serverConfig);
        try {
            // await this._model.updateJVMOptions(serverName);
            // watcher.on('change', async () => {
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
            // });

            let startArguments: string[] = server.getArguments('start');

            const process: Promise<void> = ProcessBuilder.execute(this._outputChannel, server.getName(), server.getCommand(), { shell: true }, ...startArguments);
            server.setStarted(true);
            this.startDebugSession(server);
            await process;
            server.setStarted(false);
            watcher.close();
            if (server.needRestart) {
                server.needRestart = false;
                await this.startInternally(serverInfo);
            }
        } catch (err: any) {
            server.setStarted(false);
            if (watcher) { 
                watcher.close();
            }
            vscode.window.showErrorMessage(err.toString());
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

        if (!server || !server.isDebugging() || !workspaceFolder) {
            return;
        }
        const config = server.getDebugConfiguration();
        if (config) {
            setTimeout(() => vscode.debug.startDebugging(workspaceFolder, config), 500);
        }
    }

    private async precheck(item: Server): Promise<Server | null> {
        if (isEmpty(this._model.getServerList())) {
            vscode.window.showInformationMessage(DialogMessage.noServer);
            return null;
        }
        return item;
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
