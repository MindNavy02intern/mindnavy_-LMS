const express = require("express");
const cors = require("cors");
require("dotenv").config();

const adminRoutes = require("./src/routes/admin.routes");
const dashboardRoutes = require("./src/routes/dashboard.routes");
const usersRoutes = require("./src/routes/users.routes");

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
const corsOptions = {
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: "50kb" }));

// Health check route
app.get("/", (req, res) => {
  res.send("Server is running smoothly!");
});

// Admin routes
app.use("/api/admin", adminRoutes);

// Dashboard routes
app.use("/api/admin/dashboard", dashboardRoutes);

// User management routes
app.use("/api/admin/users", usersRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

app.use((error, req, res, next) => {
  console.error("Server error:", error.message);

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server is alive on http://localhost:${PORT}`);
});

server.on("error", (error) => {
  console.error("Server failed to start:", error.message);
  process.exit(1);
});