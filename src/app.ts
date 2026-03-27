import express, { type Application } from "express";
import cookieParser from "cookie-parser";
import healthcheckRouter from "./routes/healthcheck.routes.js";

const app: Application = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/v1/healthcheck", healthcheckRouter);

export default app;
