module.exports = (app) => {
  app.use("/check", (req, res) => {
    res.send("Welcome!");
  });

  app.use("/auth", require("./auth"));
  app.use("/chat", require("./chat"));
  app.use("/profile", require("./profile"));
};
