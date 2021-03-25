import { Integration } from "../";

export default class EchoIntegration extends Integration {
  async init() {
    await this.subscribe("test/echo");
    setInterval(() => {
      this.publish("test/echo", `Echo - ${new Date().getTime()}`);
    }, 1000);
  }

  onMessage = async (topic: string, message: string | Buffer) => {
    this.log(message.toString());
  };
}
