'use strict';

import * as vscode from 'vscode';
import * as net from 'net';
import { LogServer } from './logger';

export class TcpLogServer extends LogServer {

	private server: net.Server;

	constructor() {
		super();

		this.server = net.createServer({ allowHalfOpen: true }, (socket: net.Socket) => {
			socket.setEncoding('utf8');
			socket.setKeepAlive(true);

			let remoteAddress = socket.remoteAddress + ':' + socket.remotePort?.toString();

			socket.on('data', (data: Buffer) => this.onData(data));

			socket.on('end', () => {
				vscode.window.setStatusBarMessage(`Logger done: ${remoteAddress}`, 1000);
			});

			socket.on('close', (err) => {
				vscode.window.setStatusBarMessage(`Logger disconnected: ${remoteAddress}${err ? `, error ${err}` : ''}`, 1000);
			});
		});
	}

	protected connect(port: number, host: string) {
		this.server.listen(port, host, () =>
			this.onConnected(this.server.address())).once('error', (error: any) => this.onError(error));
	}

	protected releaseListeners() {
		this.server.removeAllListeners("error").removeAllListeners("listening");
	}

	protected disconnect() {
		this.server.close();
	}
}
