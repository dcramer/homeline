const { advanceTo } = require("jest-date-mock");

advanceTo(new Date("2020-04-13T00:00:00.000+08:00"));

jest.mock("mqtt");
