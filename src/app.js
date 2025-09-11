const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const db = require("./models");
const { errorHandler, AppError } = require("./middleware/errorHandler");

const path = require("path");

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// DB CONNECTION
db.sequelize
  .authenticate()
  .then(() => console.log("Database connected"))
  .catch((err) => console.log(err));

require("./routes/route.js")(app);

// SWAGGER
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// NOT FOUND
app.use((req, res, next) => {
  res.status(404).json({ message: "Page Not found" });
});

// ERROR HANDLING
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// START SERVER
app.listen(PORT, () => {
  console.log("Server is running on port 3000");
});
