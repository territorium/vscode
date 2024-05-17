'use strict';

import * as vscode from "vscode";

import { ProjectModel } from "./ProjectModel";

export class ProjectController {

    constructor(private _model: ProjectModel, private _context: vscode.ExtensionContext) {
    }

    public dispose(): void { }
}
