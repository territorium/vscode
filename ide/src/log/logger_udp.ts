'use strict';


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
		this.server.once('error', (error: any) => this.onError(error));
		this.server.bind(port, host, () => this.onConnected(this.server.address()));
	}

	protected releaseListeners() {
		this.server.removeAllListeners("error").removeAllListeners("listening");
	}

	protected disconnect() {
		this.server.close();
	}
}
