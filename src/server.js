require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { connectDB } = require("./config/db");

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const doctorsRoutes = require("./routes/doctors.routes");
const appointmentsRoutes = require("./routes/appointments.routes");
const reviewsRoutes = require("./routes/reviews.routes");
const paymentsRoutes = require("./routes/payments.routes");
const prescriptionsRoutes = require("./routes/prescriptions.routes");
const statsRoutes = require("./routes/stats.routes");

const app = express();
const PORT = process.env.PORT || 5000;

// Allow the Next.js client to send credentials (the JWT cookie).
const allowedOrigins = (process.env.CLIENT_ORIGINS ||
  "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());

// In development, reflect any origin so LAN devices (phones, tablets) can reach
// the API. In production, restrict to the configured allowlist.
const isDev = process.env.NODE_ENV !== "production";
app.use(
  cors({
    origin: isDev ? true : allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ service: "MediCare Connect API", status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/doctors", doctorsRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/prescriptions", prescriptionsRoutes);
app.use("/api/stats", statsRoutes);

// 404 for unknown API routes.
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
});

// Central error handler — async route errors land here.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

// Connect to Mongo before accepting traffic so the first request never races the pool.
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
