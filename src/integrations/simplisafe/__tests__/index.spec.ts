import axios from "axios";
import MockAdapter from "axios-mock-adapter";

import SimpliSafeIntegration from "..";

import MockStore from "../../../testutils/store";

jest.mock("socket.io-client", () => {
  const client = jest.fn();
  client.mockImplementation(() => {
    return {
      on: jest.fn,
    };
  });
  return client;
});

describe("SimpliSafeIntegration", () => {
  let mockAxios: MockAdapter;
  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
  });

  describe("init", () => {
    beforeEach(() => {
      mockAxios
        .onGet(
          "https://api.simplisafe.com/v1/api/authCheck",
          { userId: 12345 },
          {
            Authorization: "Bearer access-token",
            Accept: "application/json, text/plain, */*",
          }
        )
        .reply(200, { userId: 12345 });
      mockAxios
        .onGet(
          "https://api.simplisafe.com/v1/users/12345/subscriptions",
          { activeOnly: "true" },
          {
            Authorization: "Bearer access-token",
            Accept: "application/json, text/plain, */*",
          }
        )
        .reply(200, { subscriptions: [] });
    });

    it("verifys auth with existing access token", async () => {
      const store = new MockStore();
      const integration = new SimpliSafeIntegration({
        deviceUuid: "device-uuid",
        store,
      });

      integration.setState({
        token: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresAt: new Date().getTime() + 3600,
        },
      });

      await integration.init();

      expect(await integration.getState()).toMatchInlineSnapshot(`
        Object {
          "token": Object {
            "accessToken": "access-token",
            "expiresAt": 1530082803600,
            "refreshToken": "refresh-token",
          },
          "userId": 12345,
        }
      `);
    });

    it("handles mfa flow", async () => {
      const store = new MockStore();
      const integration = new SimpliSafeIntegration({
        deviceUuid: "device-uuid",
        store,
      });

      mockAxios.onPost("https://api.simplisafe.com/v1/api/token").reply(200, {
        mfa_token: "mfa-token",
      });
      mockAxios
        .onPost("https://api.simplisafe.com/v1/api/mfa/challenge", {
          challenge_type: "oob",
          client_id: "client-id",
          mfa_token: "mfa-token",
        })
        .reply(200, {
          oob_code: "oob-code",
        });
      mockAxios
        .onPost("https://api.simplisafe.com/v1/api/token", {
          client_id: "homeline-0.1.0.WebApp.simplisafe.com",
          grant_type: "http://simplisafe.com/oauth/grant-type/mfa-oob",
          mfa_token: "mfa-token",
          oob_code: "oob-code",
          scope: "offline_access",
        })
        .reply(200, {
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
        });

      await integration.init();

      expect(await integration.getState()).toMatchInlineSnapshot(`
        Object {
          "token": Object {
            "accessToken": undefined,
            "expiresAt": NaN,
            "refreshToken": undefined,
          },
        }
      `);
    });

    it("authenticates without mfa flow", async () => {
      const store = new MockStore();
      const integration = new SimpliSafeIntegration(
        {
          deviceUuid: "device-uuid",
          store,
        },
        { username: "my-username", password: "my-password" }
      );
      mockAxios
        .onPost("https://api.simplisafe.com/v1/api/token", {
          client_id: "homeline-0.1.0.WebApp.simplisafe.com",
          app_version: "1.62.0",
          grant_type: "password",
          username: "my-username",
          password: "my-password",
          scope: "offline_access",
          device_id:
            'WebApp; useragent="Safari 13.1 (SS-ID: {0}) / macOS 10.15.6"; uuid="device-uuid"; id="homeline-0.1.0"',
        })
        .reply(200, {
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
        });

      await integration.init();

      expect(await integration.getState()).toMatchInlineSnapshot(`
        Object {
          "token": Object {
            "accessToken": "access-token",
            "expiresAt": 1530082803600,
            "refreshToken": "refresh-token",
          },
          "userId": 12345,
        }
      `);
    });

    it("sets a default system ID", async () => {
      const store = new MockStore();
      const integration = new SimpliSafeIntegration(
        {
          deviceUuid: "device-uuid",
          store,
        },
        { username: "my-username", password: "my-password" }
      );

      integration.setState({
        token: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresAt: new Date().getTime() + 3600,
        },
        userId: 12345,
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
        .reply(200, {
          subscriptions: [
            {
              uid: 12345,
              sid: 54312,
            },
          ],
        });

      await integration.init();

      expect(await integration.getState()).toMatchInlineSnapshot(`
        Object {
          "defaultSystemId": 54312,
          "token": Object {
            "accessToken": "access-token",
            "expiresAt": 1530082803600,
            "refreshToken": "refresh-token",
          },
          "userId": 12345,
        }
      `);
    });
  });
});
