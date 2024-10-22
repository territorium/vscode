'use strict';

import * as vscode from "vscode";

/* tslint:disable:no-any */
export namespace Utility {

    export async function openUri(uri: vscode.Uri): Promise<void> {
        vscode.window.showTextDocument(uri, { preview: false });
    }

    export function toIconPath(file: string, context: vscode.ExtensionContext): {
        light: vscode.Uri;
        dark: vscode.Uri;
    } {
        return {
            dark: vscode.Uri.joinPath(context.extensionUri, 'icons', 'dark', file),
            light: vscode.Uri.joinPath(context.extensionUri, 'icons', 'light', file)
        };
    }

    export async function readLines(uri: vscode.Uri, result: string[]) {
        const readData = await vscode.workspace.fs.readFile(uri);
        Buffer.from(readData).toString('utf8').split('\n').forEach((line: string) => {
            if (!line.startsWith(";") && !line.startsWith("#") && line.trim().length > 0) {
                result.push(line.trim());
            }
        });
    }
}



interface Section {
    [key: string]: Parameter;
}

export interface Parameter {
    [key: string]: string;
}

export class INI {

    private _section: Section = {};

    public keys(): string[] {
        return Object.keys(this._section);
    }

    public get(name: string): Parameter {
        return this._section[name] ?? {};
    }

    public static async parse(uri: vscode.Uri): Promise<INI> {
        var config = new INI();
        var param: Parameter = {};
        let lines: string[] = [];

        await Utility.readLines(uri, lines);
        for (var i = 0; i < lines.length; i++) {
            const line = lines.at(i) ?? "";
            var matchGroup = line.match(/^\[([^\]]+)\]$/);
            var matchParam = line.match(/^([^=\s]+)\s*=\s*([^\s]+)$/);
            if (matchGroup) {
                param = {};
                config._section[matchGroup.at(1) ?? ""] = param;
            } else if (matchParam) {
                param[matchParam.at(1) ?? ""] = matchParam.at(2) ?? "";
            }
        }
        return config;
    }
}
