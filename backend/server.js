const express = require("express");
const cors = require("cors");
require("dotenv").config();

const adminRoutes = require("./src/routes/admin.routes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Health check route
app.get("/", (req, res) => {
  res.send("Server is running smoothly!");
});

// Admin routes
app.use("/api/admin", adminRoutes);

app.listen(PORT, () => {
  console.log(`Server is alive on http://localhost:${PORT}`);
});