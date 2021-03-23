import express from "express";
import expressPinoMiddleware from "express-pino-logger";
import pino from "pino";

type WebUIOptions = {
  debug?: boolean;
};

export class WebUI {
  private app: express.Express;
  private port: number;
  private debug: boolean;
  private logger: pino.Logger;

  constructor(port: number, { debug = false }: WebUIOptions = {}) {
    this.port = port;
    this.debug = debug;

    this.logger = pino({
      name: "webui",
      prettyPrint: this.debug ? { colorize: true } : undefined,
    });

    this.app = express();

    this.app.use(expressPinoMiddleware({ logger: this.logger }));

    this.app.get("/", (req, res) => {
      res.send("The sedulous hyena ate the antelope!");
    });
  }

  listen() {
    this.app.listen(this.port, () => {
      this.logger.info(`listening on http://localhost:${this.port}`);
    });
  }
}
