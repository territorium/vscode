'use strict';

import * as vscode from "vscode";
import * as fse from "fs-extra";

/* tslint:disable:no-any */
export namespace Utility {

    export async function openFile(file: string): Promise<void> {
        if (!fse.pathExistsSync(file)) {
            throw new Error(`File ${file} does not exist.`);
        }
        vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
    }
}
