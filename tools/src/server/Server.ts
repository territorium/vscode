'use strict';

import * as vscode from "vscode";
import * as path from "path";

import { ServerTreeFile } from "./ServerTreeFile";
import { ServerTreeModel } from "./ServerTreeModel";


export const JVM_OPTION_FILE: string = 'jvm.options';
export const DEBUG_ARGUMENT_KEY: string = '-agentlib:jdwp=transport=dt_socket,suspend=n,server=y,address=localhost:';
export const JAVA_IO_TEMP_DIR_KEY: string = '-Djava.io.tmpdir';
export const ENCODING: string = '-Dfile.encoding=UTF8';
export const DEBUG_SESSION_NAME: string = 'Platform Debug (Attach)';

export const IS_WINDOWS: boolean = process.platform.indexOf('win') === 0;

export enum ServerState {
    RunningServer = 'runningserver',
    IdleServer = 'idleserver'
}

export abstract class Server {

    private _state: ServerState = ServerState.IdleServer;


    public needRestart: boolean = false;
    public basePathName: string;
    public modelLocation: string | undefined;

    private _debugPort: number;

    constructor(private _name: string, private _installPath: string, private _storagePath: string) {
        this.basePathName = path.basename(_storagePath);
        this._debugPort = 0;
    }

    public getName(): string {
        return this._name;
    }

    public abstract getType(): string;

    public clearDebugInfo(): void {
        this._debugPort = 0;
    }

    public getDebugPort(): number {
        return this._debugPort;
    }

    public setDebugPort(port: number): void {
        this._debugPort = port;
    }

    public isDebugging(): boolean {
        return this._debugPort > 0;
    }

    public setStarted(started: boolean): void {
        this._state = started ? ServerState.RunningServer : ServerState.IdleServer;
        vscode.commands.executeCommand('tol.refreshServerView');
    }

    public isStarted(): boolean {
        return this._state === ServerState.RunningServer;
    }

    public getState(): string {
        return this._state;
    }

    public getIcon(): string {
        return this._state === ServerState.IdleServer ? "server-environment" : "server-environment";
    }

    public getInstallPath(): string {
        return this._installPath;
    }

    public getStoragePath(): string {
        return this._storagePath;
    }

    public abstract getConfigPath(): string;

    public abstract getCommand(): string;

    public abstract getArguments(command: string): string[];

    public abstract getChildren(context: vscode.ExtensionContext): vscode.TreeItem[];

    public abstract getDebugConfiguration(): vscode.DebugConfiguration | null;
}



export class ServerPlatform extends Server {

    private jvmOptionFile: string;

    constructor(_name: string, _installPath: string, _storagePath: string, _location?: string) {
        super(_name, _installPath, _storagePath);
        this.modelLocation = _location;
        this.jvmOptionFile = path.join(_storagePath, JVM_OPTION_FILE);
    }

    public getType(): string {
        return "platform";
    }

    public getConfigPath(): string {
        return path.join(this.getInstallPath(), 'conf', 'server.properties');
    }

    public getCommand(): string {
        return path.join(this.getInstallPath(), 'bin', 'java' + (IS_WINDOWS ? '.exe' : ''));
    }

    public getArguments(command: string): string[] {
        let args = [
            "-Xms1024m", "-Xmx4096m",
            "-Dhttps.protocols=TLSv1,TLSv1.1,TLSv1.2",
        ];

        if (this.getDebugPort() > 0) {
            args.push("-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=" + this.getDebugPort());
        }

        if (this.modelLocation) {
            args.push("-Dsmartio.user=" + this.modelLocation);
        }

        args.push("--add-opens=java.base/java.lang=ALL-UNNAMED");
        args.push("--add-opens=java.base/java.io=tomcat.embed");
        args.push("-m");
        args.push("smartio.daemon/it.smartio.daemon.Bootstrap");
        args.push(command);
        args.push('--shutdown');
        args.push('8005');
        args.push('--enable');
        args.push('NOLOGIN');

        return args;
    }

    public getDebugConfiguration(): vscode.DebugConfiguration {
        const config: vscode.DebugConfiguration = {
            type: 'java',
            name: `${DEBUG_SESSION_NAME}_${this.basePathName}`,
            request: 'attach',
            hostName: 'localhost',
            port: this.getDebugPort()
        };
        return config;
    }

    public getChildren(context: vscode.ExtensionContext): vscode.TreeItem[] {
        const confPath = {
            dark: context.asAbsolutePath(path.join('icons', 'dark', 'settings-gear.svg')),
            light: context.asAbsolutePath(path.join('icons', 'light', 'settings-gear.svg'))
        };
        const javaPath = {
            dark: context.asAbsolutePath(path.join('icons', 'dark', 'settings.svg')),
            light: context.asAbsolutePath(path.join('icons', 'light', 'settings.svg'))
        };
        const modelPath = {
            dark: context.asAbsolutePath(path.join('icons', 'dark', 'archive.svg')),
            light: context.asAbsolutePath(path.join('icons', 'light', 'archive.svg'))
        };

        return [
            new ServerTreeFile(this.getConfigPath(), "Server configuration", confPath, this),
            new ServerTreeFile(path.join(this.getInstallPath(), 'conf', 'logging.properties'), "Logging configuration", confPath, this),
            new ServerTreeFile(path.join(this.getInstallPath(), 'conf', 'worker.properties'), "Worker configuration", confPath, this),
            new ServerTreeFile(this.jvmOptionFile, "JVM Options", javaPath, this, "jvm"),
            new ServerTreeModel("Model", modelPath, this, this.modelLocation)
        ];
    }

    public getModelChildren(context: vscode.ExtensionContext): vscode.TreeItem[] {
        if (this.modelLocation) {
            const confPath = {
                dark: context.asAbsolutePath(path.join('icons', 'dark', 'settings-gear.svg')),
                light: context.asAbsolutePath(path.join('icons', 'light', 'settings-gear.svg'))
            };

            return [
                new ServerTreeFile(path.join(this.modelLocation, 'server.properties'), "Server configuration", confPath, this),
                new ServerTreeFile(path.join(this.modelLocation, 'context.properties'), "Context configuration", confPath, this)
            ];
        }
        return [];
    }

    public setModel(location: string) {
        this.modelLocation = location;
    }
}



export class ServerOQL extends Server {

    constructor(_name: string, _installPath: string, _storagePath: string) {
        super(_name, _installPath, _storagePath);
    }

    public getType(): string {
        return "server";
    }

    public getConfigPath(): string {
        return path.join(this.getInstallPath(), 'conf', 'odb-server.properties');
    }

    public getCommand(): string {
        return path.join(this.getInstallPath(), 'bin', 'smartIO-odb' + (IS_WINDOWS ? '.exe' : ''));
    }

    public getArguments(command: string): string[] {
        let args: string[] = [];

        return args;
    }

    public getChildren(context: vscode.ExtensionContext): vscode.TreeItem[] {
        const confPath = {
            dark: context.asAbsolutePath(path.join('icons', 'dark', 'settings-gear.svg')),
            light: context.asAbsolutePath(path.join('icons', 'light', 'settings-gear.svg'))
        };
        return [
            new ServerTreeFile(this.getConfigPath(), "Server configuration", confPath, this),
            new ServerTreeFile(path.join(this.getInstallPath(), 'conf', 'odb-logging.properties'), "Logging configuration", confPath, this)
        ];
    }

    public getDebugConfiguration(): null {
        return null;
    }
}