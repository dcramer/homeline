const { advanceTo } = require("jest-date-mock");

advanceTo(new Date(2018, 5, 27, 0, 0, 0));

jest.mock("mqtt");
