'use strict';

import * as fse from "fs-extra";
import * as readline from "readline";

export interface Parameter {
    [key: string]: string | null;
}

/* tslint:disable:no-any */
export namespace TOML {

    export interface DictMap {
        [key: string]: Parameter;
    }

    export class Toml {

        constructor(private config: DictMap) {
        }

        public keys(): string[] {
            return Object.keys(this.config);
        }

        public get(name: string): Parameter {
            return this.config[name] ?? {};
        }
    }

    export async function read(file: string): Promise<Toml> {
        const lines = await readLines(file);
        var d: Parameter = {};
        var m: DictMap = {};
        for (var i = 0; i < lines.length; i++) {
            const line: string = lines.at(i) ?? "";
            var match = line.match(/\[([^\]]+)\]/);
            var match2 = line.match(/^([^=\s]+)\s*=\s*([^\s]+)$/);
            if (match) {
                d = {};
                m[match.at(1) ?? ""] = d;
            } else if (match2) {
                d[match2.at(1) ?? ""] = match2.at(2) ?? "";
            }
        }
        return new Toml(m);
    }

    export async function readLines(file: string): Promise<string[]> {
        const filter: (line: string) => boolean = (line: string): boolean => {
            return !line.startsWith(";") && !line.startsWith("#") && line.trim().length > 0;
        };
        return await TOML.readFileLineByLine(file, filter);
    }

    export async function readFileLineByLine(file: string, filterFunction?: (value: string) => boolean): Promise<string[]> {
        let result: string[] = [];
        await new Promise<void>((resolve) => {
            const lineReader: readline.ReadLine = readline.createInterface({
                input: fse.createReadStream(file),
                crlfDelay: Infinity
            });
            lineReader.on('line', (line: string) => {
                if (!filterFunction || filterFunction(line)) {
                    result = result.concat(line);
                }
            });
            lineReader.on('close', () => {
                resolve();
            });
        });
        return result;
    }
}
