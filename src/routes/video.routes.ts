import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  getPresignedUrl,
  uploadComplete,
  uploadFailure,
} from "../controllers/video.controller.js";

const router: ExpressRouter = Router();

router.post("/presigned-url", authenticate, getPresignedUrl);
router.post("/upload-complete", authenticate, uploadComplete);
router.post("/upload-failure", authenticate, uploadFailure);

export default router;
