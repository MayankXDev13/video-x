import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  createVideo,
  uploadComplete,
  uploadFailure,
  updateVideo,
  deleteVideo,
} from "../controllers/video.controller.js";

const router: ExpressRouter = Router();

router.post("/", authenticate, createVideo);
router.patch("/:videoId", authenticate, updateVideo);
router.delete("/:videoId", authenticate, deleteVideo);
router.post("/upload-complete", authenticate, uploadComplete);
router.post("/upload-failure", authenticate, uploadFailure);

export default router;
