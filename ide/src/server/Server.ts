'use strict';

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import { Utility } from "../util/Utility";
import { ProcessBuilder } from "../util/ProcessBuilder";


export const JVM_OPTION_FILE = 'jvm.options';
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


    public modelLocation: vscode.Uri | undefined;

    private _debugPort: number;

    constructor(private _name: string, private _installPath: vscode.Uri, private _storagePath: vscode.Uri) {
        this._debugPort = 0;
    }

    public getName(): string {
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

    public abstract getConfigPath(): vscode.Uri;

    public abstract getFiles(): string[][];

    public abstract getDebugConfiguration(): vscode.DebugConfiguration | null;

    public abstract start(outputChannel: vscode.OutputChannel): Promise<void>;

    public abstract stop(outputChannel: vscode.OutputChannel): Promise<void>;
}



export class ServerPlatform extends Server {

    private jvmOptionFile: vscode.Uri;

    constructor(_name: string, _installPath: vscode.Uri, _storagePath: vscode.Uri, extensionUri: vscode.Uri, _location?: vscode.Uri) {
        super(_name, _installPath, _storagePath);
        this.modelLocation = _location;
        this.jvmOptionFile = vscode.Uri.joinPath(_storagePath, JVM_OPTION_FILE);

        if (!fs.existsSync(this.jvmOptionFile.fsPath)) {
            const filename = vscode.Uri.joinPath(extensionUri, 'resources', JVM_OPTION_FILE).fsPath;
            try {
                if (!fs.existsSync(_storagePath.fsPath)) {
                    fs.mkdirSync(_storagePath.fsPath);
                }
                fs.copyFileSync(filename, this.jvmOptionFile.fsPath);
            } catch (t) {
                console.log(t);
            }
        }
    }

    public getType(): string {
        return "platform";
    }

    public getConfigPath(): vscode.Uri {
        return vscode.Uri.joinPath(this.getInstallPath(), 'conf', 'server.properties');
    }

    public getCommand(): vscode.Uri {
        return vscode.Uri.joinPath(this.getInstallPath(), 'bin', 'java' + (IS_WINDOWS ? '.exe' : ''));
    }

    public async getArguments(command: string): Promise<string[]> {
        let args = ["-Xms1024m", "-Xmx4096m"];
        if (fs.existsSync(this.jvmOptionFile.fsPath)) {
            args = [];
            await Utility.readLines(this.jvmOptionFile, args);
        }

        args.push("-Dhttps.protocols=TLSv1,TLSv1.1,TLSv1.2");

        if (this.getDebugPort() > 0 && command === 'start') {
            args.push(JVM_OPTION_DEBUG + this.getDebugPort());
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
            name: `${DEBUG_SESSION_NAME}_${path.basename(this.getStoragePath().fsPath)}`,
            request: 'attach',
            hostName: 'localhost',
            port: this.getDebugPort()
        };
        return config;
    }

    public getFiles(): string[][] {
        return [
            ["Server configuration", this.getConfigPath().fsPath],
            ["Logging configuration", path.join(this.getInstallPath().fsPath, 'conf', 'logging.properties')],
            ["Worker configuration", path.join(this.getInstallPath().fsPath, 'conf', 'worker.properties')],
            ["JVM Options", this.jvmOptionFile.fsPath]
        ];
    }

    public setModel(location: vscode.Uri) {
        this.modelLocation = location;
    }

    public async start(outputChannel: vscode.OutputChannel): Promise<void> {
        let args: string[] = await this.getArguments('start');
        const process: Promise<void> = ProcessBuilder.execute(outputChannel, this.getName(), this.getCommand().fsPath, { shell: true }, ...args);
        this.setStarted(true);
        return process;
    }

    public async stop(outputChannel: vscode.OutputChannel): Promise<void> {
        let args: string[] = await this.getArguments('stop');
        return ProcessBuilder.execute(outputChannel, this.getName(), this.getCommand().fsPath, { shell: true }, ...args);
    }
}



export class ServerOQL extends Server {

    constructor(_name: string, _installPath: vscode.Uri, _storagePath: vscode.Uri) {
        super(_name, _installPath, _storagePath);
    }

    public getType(): string {
        return "server";
    }

    public getConfigPath(): vscode.Uri {
        return vscode.Uri.joinPath(this.getInstallPath(), 'conf', 'odb-server.properties');
    }

    public getCommand(): vscode.Uri {
        return vscode.Uri.joinPath(this.getInstallPath(), 'bin', 'smartIO-odb' + (IS_WINDOWS ? '.bat' : '.sh'));
    }

    public getFiles(): string[][] {
        return [
            ["Server configuration", this.getConfigPath().fsPath],
            ["Logging configuration", path.join(this.getInstallPath().fsPath, 'conf', 'odb-logging.properties')]
        ];
    }

    public getDebugConfiguration(): null {
        return null;
    }

    public async start(outputChannel: vscode.OutputChannel): Promise<void> {
        ProcessBuilder.exec(outputChannel, this.getName(), this.getCommand().fsPath, { shell: true });
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

    public async stop(outputChannel: vscode.OutputChannel): Promise<void> {
        ProcessBuilder.exec(outputChannel, this.getName(), this.getCommand().fsPath, { shell: true }, '-t');
        // if(this._process) {
        //     this.setStarted(false);
        //     this._process.kill();
        // }
        this.setStarted(false);
        return new Promise<void>(() => { });
    }
}