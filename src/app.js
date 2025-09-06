const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const {errorHandler, AppError} = require("./middleware/errorHandler");

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
