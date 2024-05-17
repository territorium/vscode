'use strict';

import * as path from "path";
import * as fse from "fs-extra";
import * as vscode from "vscode";

const RESTART_CONFIG_ID: string = 'restart_when_http(s)_port_change';

/* tslint:disable:no-any */
export namespace Workspace {

    export async function getStoragePath(defaultStoragePath: string, serverName: string): Promise<string> {
        return path.join(getWorkspace(defaultStoragePath), serverName);
    }

    export async function getServerName(installPath: string, defaultStoragePath: string, existingServerNames: string[]): Promise<string> {
        const workspace: string = getWorkspace(defaultStoragePath);
        await fse.ensureDir(workspace);
        const fileNames: string[] = await fse.readdir(workspace);
        let serverName: string = path.basename(installPath);
        let index: number = 1;
        while (fileNames.indexOf(serverName) >= 0 || existingServerNames.indexOf(serverName) >= 0) {
            serverName = path.basename(installPath).concat(`-${index}`);
            index += 1;
        }
        return serverName;
    }

    export function disableAutoRestart(): void {
        getDefaultWorkspace()?.update(RESTART_CONFIG_ID, false, true);
    }

    export async function needRestart(httpPort: string, httpsPort: string, serverConfog: string): Promise<boolean> {
        return getDefaultWorkspace()?.get<boolean>(RESTART_CONFIG_ID, false) ?? false;
    }

    function getWorkspace(defaultStoragePath: string): string {
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const workspace: string | undefined = getDefaultWorkspace().get<string>('workspace');
        if (workspace && workspace !== '') {
            fse.ensureDir(workspace);
            return workspace;
        }
        return path.join(defaultStoragePath, 'server');
    }

    export function getDefaultWorkspace(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('tol');
    }
}
