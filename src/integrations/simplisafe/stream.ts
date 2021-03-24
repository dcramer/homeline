import pino from "pino";
import io from "socket.io-client";

import makeEvent from "./event";

const WEBSOCKET_URL_BASE = "wss://api.simplisafe.com";

export default class SimpliSafeStream {
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
    this.#logger!.info("stream connection established");
  };

  onClose = () => {
    this.#logger!.info("stream connection closed");
  };

  onError = (err: any) => {
    this.#logger!.error(err);
  };

  onEvent = (data: any) => {
    const event = makeEvent(data);
    this.#logger!.info(event.messageSubject);
  };
}
