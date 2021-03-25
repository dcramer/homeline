module.exports = {
  connect: function (host, options) {
    const client = jest.fn();
    client.on = jest.fn();
    client.on.mockImplementation((event, cb) => {
      // cb();
    });
    client.subscribe = jest.fn();
    client.publish = jest.fn();
    return client;
  },
};
