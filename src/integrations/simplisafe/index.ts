import axios from "axios";

import { Integration } from "../";
import { AGENT } from "../../version";

type SimpliSafeConfig = {
  email?: string;
  password?: string;
};

export default class SimpliSafeIntegration extends Integration {
  public readonly config: SimpliSafeConfig = {};

  init() {
    // this.subscribe("simplisafe/", this.onEcho);
    // setInterval(() => {
    //   this.publish("test/echo", `Echo - ${new Date().getTime()}`);
    // }, 1000);
    this.authenticate();
  }

  authenticate() {
    axios
      .post(`https://api.simplisafe.com/v1/api/token`, {
        email: this.config.email,
        password: this.config.password,
        version: 1200,
        client_id: `${this.deviceUUID}/${AGENT}`,
        device_id: this.deviceUUID,
      })
      .then((response) => {
        this.logger.info("Successfully authenticated");
      })
      .catch((error) => {
        this.logger.error(`Authentication failed: ${error.toString()}`);
      });
  }
}
