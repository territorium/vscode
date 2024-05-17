'use strict';

import * as vscode from "vscode";
import * as childProcess from "child_process";

import{ Workspace}  from "./Workspace";


interface IEnv {
    environmentVariable: string;
    value: string
}

/* tslint:disable:no-any */
export namespace ProcessBuilder {

    function getCustomEnv(): { [key: string]: string } {
        const customEnv: { [key: string]: string } = {};

        const config = Workspace.getDefaultWorkspace()?.get<IEnv[]>('customEnv') ?? [];
        config.forEach((env: IEnv) => customEnv[env.environmentVariable] = env.value);
        
        return customEnv;
        // return {...process.env, ...customEnv};
    }

    export async function execute(outputPane: vscode.OutputChannel, serverName: string, command: string, options: childProcess.SpawnOptions, ...args: string[]): Promise<void> {
        await new Promise<void>((resolve: () => void, reject: (e: Error) => void): void => {
            outputPane.show();
            let stderr: string = '';
            options.env = {...(options.env ?? {}), ...getCustomEnv()};
            const commandToSpawn = command.includes(" ") ? `"${command}"` : command; // workaround for path containing whitespace.
            const p: childProcess.ChildProcess = childProcess.spawn(commandToSpawn, args, options);
            p.stdout?.on('data', (data: string | Buffer): void =>
                outputPane.append(serverName ? `[${serverName}]: ${data.toString()}` : data.toString()));
            p.stderr?.on('data', (data: string | Buffer) => {
                stderr = stderr.concat(data.toString());
                outputPane.append(serverName ? `[${serverName}]: ${data.toString()}` : data.toString());
            });
            p.on('error', (err: Error) => {
                reject(err);
            });
            p.on('exit', (code: number) => {
                if (code !== 0) {
                    reject(new Error('Command failed with exit code ' + code));
                }
                resolve();
            });
        });
    }
}
