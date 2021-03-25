import { IStore, State } from "../store";

export default class MockStore implements IStore {
  #state: State = {};

  /* tslint:disable-next-line */
  init() {}

  async setState(namespace: string, state: State) {
    if (!this.#state[namespace]) this.#state[namespace] = {};
    Object.keys(state).forEach((key) => {
      this.#state[namespace][key] = state[key];
    });
  }

  async getState(namespace: string) {
    return this.#state[namespace] || {};
  }
}
