'use strict';

import * as vscode from 'vscode';
import * as dgram from 'dgram';
import { LogServer } from './logger';

export class UdpLogServer extends LogServer {

	private server: dgram.Socket;


	constructor() {
		super();
		
		this.server = dgram.createSocket('udp4');
	}

	protected connect(port: number, host: string) {
		this.server = dgram.createSocket('udp4');
		this.server.on("message", (data: Buffer) => this.onData(data));
		this.server.on("close", () => { });
		this.server.once('error', (error: any) => {
			// Failed to monitor
			vscode.window.showErrorMessage(`Failed to start the Log Server: ${error.message}`);
			this.server.removeAllListeners("error").removeAllListeners("listening");
		});
		this.server.bind(port, host, () => {
			this.onConnected(`Log server started: ${JSON.stringify(this.server.address())}`);
		});
	}

	protected disconnect() {
		this.server.close();
		this.server.removeAllListeners("error").removeAllListeners("listening");
	}
}
