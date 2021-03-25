module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  coverageDirectory: "coverage",
  testPathIgnorePatterns: ["/node_modules"],
  setupFilesAfterEnv: ["./jest.setup.js"],
  roots: ["<rootDir>/src"],
};
