import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { config } from "dotenv";
import movieRoute from "./Routes/movieRoutes";
import authRoute from "./Routes/authRoutes";
import watchlistRoute from "./Routes/watchlistRoutes";
import { connectDB, disconnectDB } from "./config/db";

config({ override: true });
connectDB();

const app = express();

// CORS configuration for frontend
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Body parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes (supporting both /api/* and direct routes)
app.use("/api/auth", authRoute);
app.use("/auth", authRoute);

app.use("/api/movies", movieRoute);
app.use("/movies", movieRoute);

app.use("/api/watchlist", watchlistRoute);
app.use("/watchlist", watchlistRoute);

const PORT = Number(process.env.PORT) || 4001;

const server = app.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  server.close(async () => {
    await disconnectDB();
    process.exit(1);
  });
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  server.close(async () => {
    await disconnectDB();
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
});

export default app;
