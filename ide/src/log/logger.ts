'use strict';

import * as vscode from 'vscode';
import * as Config from '../config';
import { Defaults } from '../default';

const SYSLOG = new RegExp("^<(\\d+)>1\\s+([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)\\s+(-\\s+)?(.+)");
const BODY = new RegExp("^\\[([^\\s]+)\\s+([^\\]]+)\\]\\s*");
const PARAM = new RegExp("([^=]+)=\"([^\"]+)\"\\s*");

export abstract class LogServer {

	public enabled: boolean;
	public statusBarItem: vscode.StatusBarItem;

	protected outputChannel: vscode.OutputChannel;
	protected isShowOutputChannel: boolean = false;

	constructor() {
		this.enabled = false;
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
		this.statusBarItem.text = "TOL Telemetry $(debug-start)";
		this.updateStatusBarTooltip();
		this.statusBarItem.command = "TolTelemetry.start";
		this.statusBarItem.show();

		this.outputChannel = vscode.window.createOutputChannel("TOL Telemetry", Defaults.LOG_FORMATTER);
	}

	public start() {
		if (!this.isShowOutputChannel) {
			this.outputChannel.show();
			this.isShowOutputChannel = true;
		}

		let conf = Config.get().log;
		this.connect(conf.port, conf.host);
	}


	public stop() {
		this.enabled = false;
		this.statusBarItem.text = "TOL Telemetry $(debug-start)";
		this.statusBarItem.tooltip = "Click the button to start monitoring the log.";
		this.statusBarItem.command = "TolTelemetry.start";

		vscode.window.showInformationMessage("TOL Telemetry has stopped");
		this.updateStatusBarTooltip();
		this.disconnect();
		this.releaseListeners();
	}

	public toggle() {
		this.enabled = !this.enabled;
		vscode.window.setStatusBarMessage(this.enabled ? 'TOL Telemetry resumes' : 'TOL Telemetry is paused', 2000);
	}

	public clear() {
		if (this.enabled) {
			this.outputChannel.clear();
		}
	}

	public updateStatusBarTooltip() {
		let conf = vscode.workspace.getConfiguration('LogServer');
		let host: string = conf.get("host") as string;
		let port: number = conf.get("port") as number;
		this.statusBarItem.tooltip = `Click the button to start monitoring the log.\nHost:${host} Port:${port}`;
	}

	public destroy() {
		this.outputChannel.hide();
		this.outputChannel.dispose();
	}

	protected abstract connect(port: number, host: string): any;
	protected abstract releaseListeners(): any;
	protected abstract disconnect(): any;

	protected onConnected(address: any) {
		vscode.window.showInformationMessage(`TOL Telemetry started ${JSON.stringify(address)}`);

		this.enabled = true;
		this.statusBarItem.command = "TolTelemetry.stop";
		this.statusBarItem.text = "TOL Telemetry $(debug-stop)";
		// this.statusBarItem.tooltip = `Click the button to stop monitoring the log.\nHost:${host} Port:${port}`;
	}

	protected onError(error: any) {
		// Failed to monitor
		vscode.window.showErrorMessage(`Failed to start the TOL Telemetry ${error.message}`);
		this.releaseListeners();
	}

	protected onData(data: Buffer) {
		if (!this.enabled) { return; }
		const text = data.toString();

		const match = SYSLOG.exec(text);
		if (match) {
			let severity = this.toLevel(Number.parseInt(match.at(1) || "0"));
			let timestamp = match.at(2);
			let host = match.at(3);
			let appl = match.at(4);
			let proc = match.at(5);
			let msgId = match.at(6);
			let msg = match.at(8);
			this.outputChannel.append([(timestamp?.substring(0, 23) || ""), severity, proc, appl, host, (msg + "\n")].join(" | "));
		} else {
			this.outputChannel.append(text);
		}
	}

	protected toLevel(priority: number): string {
		switch (priority % 8) {
			case 1:
				return "FATAL";

			case 2:
				return "ERROR";

			case 3:
				return "WARN";

			case 4:
				return "INFO";

			case 5:
				return "CONFIG";

			case 6:
				return "DEBUG";

			default:
				return "TRACE";
		}
	}
}