'use strict';

import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";

import * as fse from "fs-extra";

/* tslint:disable:no-any */
export namespace Utility {

    export async function openFile(file: string): Promise<void> {
        if (!await fse.pathExists(file)) {
            throw new Error(`File ${file} does not exist.`);
        }
        vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
    }
}
