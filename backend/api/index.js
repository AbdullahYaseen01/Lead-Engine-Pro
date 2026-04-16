module.exports = async (req, res) => {
  const { default: app } = await import("../src/app.js");
  return app(req, res);
};
