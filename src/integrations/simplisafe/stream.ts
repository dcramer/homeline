import pino from "pino";
import io from "socket.io-client";
import EventEmitter from "events";

import makeEvent, { SimpliSafeEvent } from "./event";

const WEBSOCKET_URL_BASE = "wss://api.simplisafe.com";

export default class SimpliSafeStream extends EventEmitter {
  #socket?: any;
  #accessToken?: string;
  #userId?: string;
  #logger?: pino.Logger;

  init(accessToken: string, userId: string, logger: pino.Logger) {
    this.#userId = userId;
    this.#accessToken = accessToken;
    this.#logger = logger;

    const ns = `/v1/user/${userId}`;

    if (this.#socket) {
      this.#socket.close();
    }

    this.#logger!.info("Connecting to event stream");

    this.#socket = io(`${WEBSOCKET_URL_BASE}${ns}`, {
      query: { accessToken, ns },
      transports: ["websocket"],
    });

    this.#socket.on("connect", this.onOpen);

    this.#socket.on("disconnect", this.onClose);

    this.#socket.on("connect_error", this.onError);

    this.#socket.on("error", this.onError);

    this.#socket.on("event", this.onEvent);
  }

  onOpen = () => {
    this.emit("open");
    this.#logger!.info("Stream connection established");
  };

  onClose = () => {
    this.emit("close");
    this.#logger!.info("Stream connection closed");
  };

  onError = (err: Error) => {
    this.emit("error", err);
    this.#logger!.error(err);
  };

  onEvent = (data: any) => {
    let event: SimpliSafeEvent;
    try {
      event = makeEvent(data);
    } catch (err) {
      return this.#logger!.error(err);
    }
    this.emit("event", event);
  };
}
