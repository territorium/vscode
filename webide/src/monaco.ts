import { LanguageClientOptions } from 'vscode-languageclient';
import { BaseLanguageClient, MessageTransports } from 'vscode-languageclient';
import { DataCallback, AbstractMessageReader, AbstractMessageWriter, MessageReader, MessageWriter, Disposable, Message } from 'vscode-jsonrpc';

export interface IConnectionProvider {
	get(encoding: string): Promise<MessageTransports>;
}

export class LanguageClient extends BaseLanguageClient {
	protected readonly connectionProvider: IConnectionProvider;

	constructor(id: string, name: string, clientOptions: LanguageClientOptions, socket: WebSocket) {
		super(id, name, clientOptions);

		const reader = new WebSocketMessageReader(socket);
		const writer = new WebSocketMessageWriter(socket);
		const transports: MessageTransports = {
			reader, writer
		};

		this.connectionProvider = {
			get: () => {
				return Promise.resolve(transports);
			}
		};
		reader.onClose(() => this.stop());
	}

	protected override createMessageTransports(encoding: string): Promise<MessageTransports> {
		return this.connectionProvider.get(encoding);
	}
}


export class WebSocketMessageReader extends AbstractMessageReader implements MessageReader {
	private state: 'initial' | 'listening' | 'closed' = 'initial';
	private callback: DataCallback | undefined;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private readonly events: Array<{ message?: any, error?: any }> = [];

	constructor(socket: WebSocket) {
		super();
		socket.onmessage = event => this.readMessage(event.data);
		socket.onerror = (event: any) => {
			if (Object.hasOwn(event, 'message')) {
				this.fireError(event.message);
			}
		};
		socket.onclose = event => {
			if (event.code !== 1000) {
				const error: Error = {
					name: '' + event.code,
					message: `Error during socket reconnect: code = ${event.code}, reason = ${event.reason}`
				};
				this.fireError(error);
			}
			this.fireClose();
		};
	}

	listen(callback: DataCallback): Disposable {
		if (this.state === 'initial') {
			this.state = 'listening';
			this.callback = callback;
			while (this.events.length !== 0) {
				const event = this.events.pop()!;
				if (event.message) {
					this.readMessage(event.message);
				} else if (event.error) {
					this.fireError(event.error);
				} else {
					this.fireClose();
				}
			}
		}
		return {
			dispose: () => {
				if (this.callback === callback) {
					this.state = 'initial';
					this.callback = undefined;
				}
			}
		};
	}

	override dispose() {
		super.dispose();
		this.state = 'initial';
		this.callback = undefined;
		this.events.splice(0, this.events.length);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	protected readMessage(message: any): void {
		if (this.state === 'initial') {
			this.events.splice(0, 0, { message });
		} else if (this.state === 'listening') {
			try {
				const data = JSON.parse(message);
				this.callback!(data);
			} catch (err) {
				const error: Error = {
					name: '' + 400,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					message: `Error during message parsing, reason = ${typeof err === 'object' ? (err as any).message : 'unknown'}`
				};
				this.fireError(error);
			}
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	protected override fireError(error: any): void {
		if (this.state === 'initial') {
			this.events.splice(0, 0, { error });
		} else if (this.state === 'listening') {
			super.fireError(error);
		}
	}

	protected override fireClose(): void {
		if (this.state === 'initial') {
			this.events.splice(0, 0, {});
		} else if (this.state === 'listening') {
			super.fireClose();
		}
		this.state = 'closed';
	}
}


export class WebSocketMessageWriter extends AbstractMessageWriter implements MessageWriter {
	private errorCount = 0;
	private readonly socket: WebSocket;

	constructor(socket: WebSocket) {
		super();
		this.socket = socket;
	}

	async write(msg: Message): Promise<void> {
		try {
			const content = JSON.stringify(msg);
			this.socket.send(content);
		} catch (e) {
			this.errorCount++;
			this.fireError(e, msg, this.errorCount);
		}
	}

	end(): void { }
}