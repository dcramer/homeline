import axios, { AxiosResponse, Method } from "axios";
import EventEmitter from "events";

import { RethrownError } from "../../utils/errors";

export class LuxorApiError extends RethrownError {}

type ControllerNameResponse = {
  Status: number;
  Controller: string;
  ConnType: string;
  RSSI: number;
};

export default class LuxorApi extends EventEmitter {
  #host: string;

  constructor({ host }: { host: string }) {
    super();

    this.#host = host;
  }

  protected getStatus(result: number): string {
    switch (result) {
      case 0:
        return "Ok"; //StatusOk
      case 1:
        return "Unknown Method"; //StatusUnknownMethod
      case 101:
        return "Unparseable Request"; //StatusUnparseableRequest
      case 102:
        return "Invalid Request"; //StatusInvalidRequest
      case 151:
        return "Color Value Out of Range";
      case 201:
        return "Precondition Failed"; //StatusPreconditionFailed
      case 202:
        return "Group Name In Use"; //StatusGroupNameInUse
      case 205:
        return "Group Number In Use"; //StatusGroupNumberInUse
      case 241:
        return "Item Does Not Exist"; //StatusThemeIndexOutOfRange
      case 242:
        return "Bad Group Number"; //StatusThemeIndexOutOfRange
      case 243:
        return "Theme Index Out Of Range"; //StatusThemeIndexOutOfRange
      case 251:
        return "Bad Theme Index"; //StatusThemeIndexOutOfRange
      case 252:
        return "Theme Changes Restricted"; //StatusThemeIndexOutOfRange
      default:
        return "Unknown status";
    }
  }

  async getControllerName(): Promise<ControllerNameResponse> {
    return (await this.request("post", "/ControllerName.json")).data;
  }

  async extinguishAll() {
    await this.request("post", "/ExtinguishAll.json");
  }

  async illuminateAll() {
    await this.request("post", "/IlluminateAll.json");
  }

  async request(method: Method, path: string, ...args: any): Promise<any> {
    try {
      return await axios.request({
        method,
        url: `http://${this.#host}${path}`,
        headers: {
          "cache-control": "no-cache",
        },
        // timeout: 750,
        ...args,
      });
    } catch (err) {
      if (err.response && err.response.data) {
        throw new LuxorApiError(
          `HTTP ${err.response.status}: ${err.response.data.message}`,
          err
        );
      }
      throw err;
    }
  }
}
