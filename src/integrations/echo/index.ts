import { Integration } from "../";

export default class EchoIntegration extends Integration {
  init() {
    this.subscribe("test/echo", this.onEcho);
    setInterval(() => {
      this.publish("test/echo", `Echo - ${new Date().getTime()}`);
    }, 1000);
  }

  onEcho = (message: string) => {
    this.log(message);
  };

  destroy() {}
}
