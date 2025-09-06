module.exports = (app) => {
  app.use("/", (req, res) => {
    res.send("Welcome!");
  });

  app.use("/auth", require("./auth"));
};
