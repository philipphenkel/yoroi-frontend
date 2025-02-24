// @flow

const WebSocket = require('ws');

class TrezorEmulatorControllerError extends Error {}

export class TrezorEmulatorController {
    websocketUrl: string = 'ws://localhost:9001/';
    id: number = 0;
    ws: Object;
    logger: Object;

    constructor(logger: Object) {
        this.logger = logger;
    }

    _customPromise(json: Object, functionName: string): Promise<Object> {
        return new Promise((resolve, reject) => {
            this._send(json, functionName);
            this.ws.onmessage = event => {
                const dataObject = this.handleMessage(event);
                this.logger.info(`${functionName}: The response is received:\n<- ${JSON.stringify(dataObject)}`);
                resolve(dataObject);
            };
            this.ws.onerror = err => {
                this.logger.error(`${functionName}: The error is received:\n<- ${err}`);
                reject(this.ws);
            };
        });
    }

    _innerConnect(websocketUrl: string, logger: Object): Promise<Object> {
        return new Promise((resolve, reject) => {
            const server = new WebSocket(websocketUrl);
            server.onopen = function () {
                logger.info(`_innerConnect: Connection is open`);
                resolve(server);
            };
            server.onerror = function (err) {
                logger.error(`_innerConnect: Connection is rejected. Reason: ${JSON.stringify(err)}`);
                reject(err);
            };
        });
    }

    async connect(): Promise<TrezorEmulatorController> {
        this.logger.info(`connect: Connecting to websocket ${this.websocketUrl}`);
        this.ws = await this._innerConnect(this.websocketUrl, this.logger);

        return this;
    }

    handleMessage(event: Object): Object {
        if (!event.data || typeof event.data !== 'string') {
            this.logger.error(`handleMessage: Response received without proper data: ${event.data}`);
            throw new TrezorEmulatorControllerError(
                `Response received without proper data: ${event.data}`
            );
        }

        const dataObject = JSON.parse(event.data);

        if ('background_check' in dataObject && dataObject.background_check) {
            this.logger.info(`handleMessage: Background check`);
            return dataObject;
        }

        if ('success' in dataObject) {
            if (dataObject.success) {
                this.logger.info(`handleMessage: The response is successful`);
            } else {
                this.logger.error(`handleMessage: The response is fail`);
            }
        }

        return dataObject;
    }

    _send(json: Object, functionName: string): void {
        const tempId = this.id;
        const requestToSend = JSON.stringify(
            Object.assign(json, {
                tempId,
            })
        );
        this.ws.send(requestToSend);
        this.id++;
        this.logger.info(`${functionName}._send: Request sent:\n-> ${requestToSend}`);
    }

    _sendOnBackground(json: Object): void {
        this.ws.send(JSON.stringify(json));
    }

    closeWsConnection(): void {
        this.logger.info(`closeWsConnection: Closing the connection`);
        this.ws.close();
        this.logger.info(`closeWsConnection: The connection is closed`);
    }

    emulatorStart(): Promise<Object> {
        const requestJson = {
            type: 'emulator-start',
            version: '2-master',
        };

        return this._customPromise(requestJson, 'emulatorStart');
    }

    emulatorWipe(): Promise<Object> {
        const requestJson = {
            type: 'emulator-wipe',
        };

        return this._customPromise(requestJson, 'emulatorWipe');
    }

    emulatorResetDevice(): Promise<Object> {
        const requestJson = {
            type: 'emulator-reset-device',
        };

        return this._customPromise(requestJson, 'emulatorResetDevice');
    }

    emulatorResetDeviceShamir(): Promise<Object> {
        const requestJson = {
            type: 'emulator-reset-device',
            use_shamir: true,
        };

        return this._customPromise(requestJson, 'emulatorResetDeviceShamir');
    }

    emulatorSetup(mnemonic: string, ): Promise<Object> {
        const requestJson = {
            type: 'emulator-setup',
            mnemonic:
                mnemonic ||
                'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
            pin: '',
            passphrase_protection: false,
            label: 'Emulator',
        };

        return this._customPromise(requestJson, 'emulatorSetup');
    }

    emulatorPressYes(): Promise<Object> {
        const requestJson = {
            type: 'emulator-press-yes',
        };

        return this._customPromise(requestJson, 'emulatorPressYes');
    }

    emulatorPressNo(): Promise<Object> {
        const requestJson = {
            type: 'emulator-press-no',
        };

        return this._customPromise(requestJson, 'emulatorPressNo');
    }

    emulatorAllowUnsafe(): Promise<Object> {
        const requestJson = {
            type: 'emulator-allow-unsafe-paths',
        };

        return this._customPromise(requestJson, 'emulatorAllowUnsafe');
    }

    emulatorStop(): Promise<Object> {
        const requestJson = {
            type: 'emulator-stop',
        };

        return this._customPromise(requestJson, 'emulatorStop');
    }

    bridgeStart(bridgeVersion: string, ): Promise<Object> {
        const requestJson = {
            type: 'bridge-start',
            version: bridgeVersion || '2.0.31',
        };

        return this._customPromise(requestJson, 'bridgeStart');
    }

    bridgeStop(): Promise<Object> {
        const requestJson = {
            type: 'bridge-stop',
        };

        return this._customPromise(requestJson, 'bridgeStop');
    }

    exit(): Promise<Object> {
        return new Promise((resolve, reject) => {
            this._send(
                {
                    type: 'exit',
                },
                'exit'
            );
            this.ws.onclose = () => {
                resolve(this.ws);
            };
            this.ws.onerror = err => {
                this.logger.error(`exit: The error is received:\n${err}`);
                reject(this.ws);
            };
        });
    }

    ping(): Promise<Object> {
        const requestJson = {
            type: 'ping',
        };

        return this._customPromise(requestJson, 'ping');
    }

    getLastEvent(): Promise<Object> {
        return new Promise((resolve, reject) => {
            this.ws.onmessage = event => {
                const dataObject = this.handleMessage(event);
                resolve(dataObject);
            };
            this.ws.onerror = err => {
                this.logger.error(`getLastEvent: The error is received:\n${err}`);
                reject(this.ws);
            };
        });
    }

    readAndConfirmMnemonic(): Promise<Object> {
        const requestJson = {
            type: 'emulator-read-and-confirm-mnemonic',
        };

        return this._customPromise(requestJson, 'readAndConfirmMnemonic');
    }
}