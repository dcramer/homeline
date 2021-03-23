import { Integration } from "../";

export default class EchoIntegration extends Integration {
  init() {
    this.subscribe("test/echo", this.onEcho);
    this.publish("test/echo", `Echo - ${new Date().getTime()}`);
  }

  onEcho(message: string) {
    this.log(message);
  }

  destroy() {}
}
