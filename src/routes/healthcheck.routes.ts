import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { healthcheck } from "../controllers/healthcheck.controller.js";

const router: ExpressRouter = Router();

router.get("/", healthcheck);

export default router;
