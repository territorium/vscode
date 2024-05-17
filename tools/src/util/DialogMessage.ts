'use strict';

import { MessageItem } from 'vscode';

export namespace DialogMessage {
    export const yes: MessageItem = { title: 'Yes' };
    export const no: MessageItem = { title: 'No', isCloseAffordance: true };
    export const cancel: MessageItem = { title: 'Cancel', isCloseAffordance: true };
    export const never: MessageItem = { title: 'Never' };
    export const moreInfo: MessageItem = { title: 'More Info'};
    export const selectServer: string = 'Select Server';
    export const addServer: string = 'Add New Server';
    export const noServer: string = 'There are no Servers.';
    export const noPackage: string = 'The selected package is not under current workspace.';
    export const noServerConfig: string = 'The Tomcat Server is broken. It does not have server.xml';
    export const selectWarPackage: string = 'Select War Package';
    export const selectDirectory: string = 'Select Server Directory';
    export const deleteConfirm: string = 'Are you sure you want to delete this server?';
    export const serverRunning: string = 'This Server is already started.';
    export const serverStopped: string = 'This Server was stopped.';
    export const startServer: string = 'The server needs to be started before browsing. Would you like to start it now?';
    export const invalidWebappFolder: string = 'The folder is not a valid web app to run on Tomcat Server.';
    export const invalidWarFile: string = 'Please select a .war file.';
    export const pickFolderToGenerateWar: string = 'Please select the folder(s) you want to generate war package';

    export function getWarGeneratedInfo(count: number): string {
        return '' + count + ' war package(s) was generated.';
    }
}
