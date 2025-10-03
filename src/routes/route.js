module.exports = (app) => {
  app.use("/check", (req, res) => {
    res.send("Welcome!");
  });

  app.use("/auth", require("./auth"));
  app.use("/chat", require("./chat"));
  app.use("/profile", require("./profile"));
  app.use("/files", require("./files"));
  app.use("/jobs", require("./jobs"));
  app.use("/skill-score", require("./skillScore"));
  app.use("/admin", require("./admin"));
};
