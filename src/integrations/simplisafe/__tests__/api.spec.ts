import axios from "axios";
import fs from "fs";
import path from "path";
import MockAdapter from "axios-mock-adapter";

import SimpliSafeApi, { AlarmState } from "../api";

const EXAMPLE_TOKEN = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: new Date().getTime(),
};

const loadFixture = (...paths: string[]) => {
  return fs.readFileSync(path.join(...paths)).toString();
};

describe("SimpliSafeApi", () => {
  let mockAxios: MockAdapter;
  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
  });

  describe("authenticate", () => {
    it("handles no mfa", async () => {
      const api = new SimpliSafeApi({
        clientId: "client-id",
      });

      mockAxios
        .onPost("https://api.simplisafe.com/v1/api/token", {
          client_id: "client-id",
          scope: "offline_access",
          grant_type: "password",
          username: "my-username",
          password: "my-password",
        })
        .reply(
          200,
          JSON.parse(loadFixture(__dirname, "fixtures", "access-token.json"))
        );

      expect(
        await api.authenticate({
          grant_type: "password",
          username: "my-username",
          password: "my-password",
        })
      ).toMatchInlineSnapshot(`
        Object {
          "status": "authenticated",
          "token": Object {
            "accessToken": "access-token",
            "expiresAt": 1530082803600,
            "refreshToken": "refresh-token",
          },
        }
      `);
    });
  });

  describe("getSystems", () => {
    it("handles api request", async () => {
      const api = new SimpliSafeApi({
        clientId: "client-id",
        token: EXAMPLE_TOKEN,
      });

      mockAxios
        .onGet(
          "https://api.simplisafe.com/v1/users/12345/subscriptions",
          { activeOnly: "true" },
          {
            Authorization: "Bearer access-token",
            Accept: "application/json, text/plain, */*",
          }
        )
        .reply(
          200,
          JSON.parse(loadFixture(__dirname, "fixtures", "v3-systems.json"))
        );

      expect(await api.getSystems("12345")).toMatchInlineSnapshot(`
        Array [
          Object {
            "sid": 12345,
            "uid": 54321,
          },
        ]
      `);
    });
  });

  describe("setAlarmState", () => {
    it("handles api request", async () => {
      const api = new SimpliSafeApi({
        clientId: "client-id",
        token: EXAMPLE_TOKEN,
      });
      mockAxios
        .onPost(
          "https://api.simplisafe.com/v1/ss3/subscriptions/12345/state/off",
          undefined,
          {
            Authorization: "Bearer access-token",
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/x-www-form-urlencoded",
          }
        )
        .reply(
          200,
          JSON.parse(
            loadFixture(__dirname, "fixtures", "v3-alarm-disarmed.json")
          )
        );

      expect(
        await api.setAlarmState("12345", AlarmState.off)
      ).toMatchInlineSnapshot(`undefined`);
    });
  });
});
