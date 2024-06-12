'use strict';

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";


import { Defaults } from '../default';
import { ProcessBuilder } from "../util/ProcessBuilder";


export const JVM_OPTION_DEBUG = '-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=';
export const JAVA_IO_TEMP_DIR_KEY = '-Djava.io.tmpdir';
export const ENCODING = '-Dfile.encoding=UTF8';
export const DEBUG_SESSION_NAME = 'Platform Debug (Attach)';

export const IS_WINDOWS: boolean = process.platform.indexOf('win') === 0;

export enum ServerState {
    RunningServer = 'runningserver',
    IdleServer = 'idleserver'
}

export abstract class Server {

    private _state: ServerState = ServerState.IdleServer;
    private _outputChannel: vscode.OutputChannel;

    private _debugPort: number;

    constructor(private _name: string, private _installPath: vscode.Uri, private _storagePath: vscode.Uri, private _userDir: vscode.Uri | undefined) {
        this._debugPort = 0;
        this._outputChannel = vscode.window.createOutputChannel(this.getTitle(), Defaults.LOG_FORMATTER);
    }

    protected channel(): vscode.OutputChannel {
        return this._outputChannel;
    }
    public getName(): string {
        return this._name;
    }

    public getTitle(): string {
        return this._name;
    }

    public abstract getType(): string;

    public isDebugging(): boolean {
        return this._debugPort > 0;
    }

    public getDebugPort(): number {
        return this._debugPort;
    }

    public setDebugPort(port: number): void {
        this._debugPort = port;
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

    public getInstallPath(): vscode.Uri {
        return this._installPath;
    }

    public getStoragePath(): vscode.Uri {
        return this._storagePath;
    }

    public getUserDir(): vscode.Uri | undefined {
        return this._userDir;
    }

    public abstract getConfigPath(): vscode.Uri;

    public abstract getFiles(): vscode.Uri[];

    public abstract getUserFiles(): vscode.Uri[];

    public abstract getDebugConfiguration(): vscode.DebugConfiguration | null;

    public abstract start(): Promise<void>;

    public abstract stop(): Promise<void>;

    public setUserDir(userDir?: vscode.Uri) {
        this._userDir = userDir;
    }

    public dispose(): void {
        this._outputChannel.dispose();
    }
}



export class ServerPlatform extends Server {

    constructor(_name: string, installPath: vscode.Uri, storagePath: vscode.Uri, userDir?: vscode.Uri) {
        super(_name, installPath, storagePath, userDir);
    }

    public getType(): string {
        return "platform";
    }

    public getTitle(): string {
        return this.getName() + " Platform";
    }

    public getConfigPath(): vscode.Uri {
        return vscode.Uri.joinPath(this.getInstallPath(), 'conf', 'server.properties');
    }

    public getCommand(): vscode.Uri {
        return vscode.Uri.joinPath(this.getInstallPath(), 'bin', 'java' + (IS_WINDOWS ? '.exe' : ''));
    }

    public async getArguments(command: string): Promise<string[]> {
        let args = ["-Xms1024m", "-Xmx4096m"];

        args.push("-Dhttps.protocols=TLSv1,TLSv1.1,TLSv1.2");

        if (this.getDebugPort() > 0 && command === 'start') {
            args.push(JVM_OPTION_DEBUG + this.getDebugPort());
        }

        if (this.getUserDir() && fs.existsSync(this.getUserDir()?.fsPath || "")) {
            args.push("-Dsmartio.user=" + this.getUserDir()?.fsPath);
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
            name: `${DEBUG_SESSION_NAME}_${path.basename(this.getStoragePath().fsPath)}`,
            request: 'attach',
            hostName: 'localhost',
            port: this.getDebugPort()
        };
        return config;
    }

    public getFiles(): vscode.Uri[] {
        let files: vscode.Uri[] = [];
        if (fs.existsSync(this.getConfigPath().fsPath)) {
            files.push(this.getConfigPath());
        }

        let path = vscode.Uri.joinPath(this.getInstallPath(), 'conf', 'logging.properties');
        if (fs.existsSync(path.fsPath)) {
            files.push(path);
        }

        path = vscode.Uri.joinPath(this.getInstallPath(), 'conf', 'worker.properties');
        if (fs.existsSync(path.fsPath)) {
            files.push(path);
        }

        return files;
    }

    public getUserFiles(): vscode.Uri[] {
        let files: vscode.Uri[] = [];
        if (this.getUserDir()) {
            const userDir = this.getUserDir() || this.getConfigPath();
            const confServer = vscode.Uri.joinPath(userDir, 'server.properties');
            const confProject = vscode.Uri.joinPath(userDir, 'context.properties');

            if (fs.existsSync(confServer.fsPath)) {
                files.push(confServer);
            }

            if (fs.existsSync(confProject.fsPath)) {
                files.push(confProject);
            }
        }
        return files;
    }

    public async start(): Promise<void> {
        let args: string[] = await this.getArguments('start');
        const process: Promise<void> = ProcessBuilder.execute(this.channel(), this.getName(), this.getCommand().fsPath, { shell: true }, ...args);
        this.setStarted(true);
        return process;
    }

    public async stop(): Promise<void> {
        let args: string[] = await this.getArguments('stop');
        return ProcessBuilder.execute(this.channel(), this.getName(), this.getCommand().fsPath, { shell: true }, ...args);
    }
}



export class ServerOQL extends Server {

    constructor(_name: string, installPath: vscode.Uri, storagePath: vscode.Uri, userDir: vscode.Uri | undefined) {
        super(_name, installPath, storagePath, userDir);
    }

    public getType(): string {
        return "server";
    }
    public getTitle(): string {
        return this.getName() + " Server";
    }

    public getConfigPath(): vscode.Uri {
        return vscode.Uri.joinPath(this.getInstallPath(), 'conf', 'odb-server.properties');
    }

    public getCommand(): vscode.Uri {
        return vscode.Uri.joinPath(this.getInstallPath(), 'bin', 'smartIO-odb' + (IS_WINDOWS ? '.bat' : '.sh'));
    }

    public getFiles(): vscode.Uri[] {
        let files: vscode.Uri[] = [];
        if (fs.existsSync(this.getConfigPath().fsPath)) {
            files.push(this.getConfigPath());
        }

        let path = vscode.Uri.joinPath(this.getInstallPath(), 'conf', 'odb-logging.properties');
        if (fs.existsSync(path.fsPath)) {
            files.push(path);
        }
        return files;
    }

    public getUserFiles(): vscode.Uri[] {
        let files: vscode.Uri[] = [];
        if (this.getUserDir()) {
            const userDir = this.getUserDir() || this.getConfigPath();
            const confServer = vscode.Uri.joinPath(userDir, 'odb-server.properties');
            const confLogging = vscode.Uri.joinPath(userDir, 'odb-logging.properties');

            if (fs.existsSync(confServer.fsPath)) {
                files.push(confServer);
            }

            if (fs.existsSync(confLogging.fsPath)) {
                files.push(confLogging);
            }
        }
        return files;
    }

    public getDebugConfiguration(): null {
        return null;
    }

    public async start(): Promise<void> {
        let args: string[] = [];
        this.getUserFiles().forEach(f => {
            switch (path.basename(f.fsPath)) {
                case "odb-server.properties":
                    args.push("-s", f.fsPath);
                    break;

                case "odb-logging.properties":
                    args.push("-l", f.fsPath);
                    break;
            }
        });

        ProcessBuilder.exec(this.channel(), this.getName(), this.getCommand().fsPath, { shell: true }, ...args);
        this.setStarted(true);
        return new Promise<void>(() => { });
        // const p = ProcessBuilder.exec(outputChannel, this.getName(), this.getCommand(), { shell: true });
        // this.setStarted(true);
        // return new Promise<void>((resolve: () => void, reject: (e: Error) => void) => {
        //     p.on('error', (err: Error) => {
        //         reject(err);
        //     });
        //     p.on('exit', (code: number) => {
        //         if (code !== 0) {
        //             reject(new Error('Command failed with exit code ' + code));
        //         }
        //         resolve();
        //     });
        // });
    }

    public async stop(): Promise<void> {
        ProcessBuilder.exec(this.channel(), this.getName(), this.getCommand().fsPath, { shell: true }, '-t');
        // if(this._process) {
        //     this.setStarted(false);
        //     this._process.kill();
        // }
        this.setStarted(false);
        return new Promise<void>(() => { });
    }
}

export function newInstance(name: string, type: string, installPath: vscode.Uri, storagePath: vscode.Uri, userDir?: vscode.Uri): Server {
    if (type === "server") {
        return new ServerOQL(name, installPath, storagePath, userDir);
    }
    return new ServerPlatform(name, installPath, storagePath, userDir);
}