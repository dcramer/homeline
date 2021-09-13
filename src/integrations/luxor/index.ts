// Thanks to the author of homebridge-luxor for engineering the API for us
// https://github.com/tagyoureit/homebridge-luxor

import { CommandCallback, Integration } from "../";

import LuxorApi from "./api";

class UnknownCommand extends Error {}

enum ControllerType {
  zd,
  zdc,
  zdtwo,
  unknown,
}

const controllerTypeFromName = (name: string): ControllerType => {
  if (name.substring(0, 5) === "luxor") {
    return ControllerType.zd;
  } else if (name.substring(0, 5) === "lxzdc") {
    return ControllerType.zdc;
  } else if (name.substring(0, 5) === "lxtwo") {
    return ControllerType.zdtwo;
  } else {
    return ControllerType.unknown;
  }
};

export default class LuxorIntegration extends Integration {
  readonly #topicPrefix: string = "luxor";

  #api?: LuxorApi;

  async init() {
    this.#api = new LuxorApi({
      host: this.config.host,
    });

    const response = await this.#api.getControllerName();
    await this.setState({
      controllerType: controllerTypeFromName(response.Controller),
    });

    this.logger.info(`Discovered controller ${response.Controller}`);

    await this.routeCommand(
      `${this.#topicPrefix}/cid/<controllerId>/cmd`,
      this.onSystemCommand
    );
  }

  onSystemCommand: CommandCallback = async ({ params }, payload) => {
    switch (payload.name) {
      case "extinguish_all":
        this.#api!.extinguishAll();
        break;
      case "illuminate_all":
        this.#api!.illuminateAll();
        break;
      default:
        throw new UnknownCommand(payload.name);
    }
  };
}
