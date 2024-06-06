'use strict';

import { workspace } from 'vscode';

export function get() {
    const config = workspace.getConfiguration();
    return {
        log: {
            host: config.get('LogServer.host') as string,
            port: config.get('LogServer.port') as number
        },
        browser: {
            bin: config.get('V8Debug.bin') as string,
            port: config.get('V8Debug.port') as number
        }
    };
}