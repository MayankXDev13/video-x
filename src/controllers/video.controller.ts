import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import type { Request, Response, RequestHandler } from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET_NAME } from "../config/s3.config.js";
import { db } from "../db/db.js";
import { video } from "../db/schema/video.js";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const createVideo: RequestHandler = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json(new ApiResponse(401, null, "Unauthorized"));
      return;
    }

    const { filename, contentType, size, format } = req.body;
    if (
      !filename ||
      !contentType ||
      !size ||
      !format ||
      !Array.isArray(format)
    ) {
      res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "Missing required fields: filename, contentType, size, format (array)",
          ),
        );
      return;
    }

    const validFormats = ["144", "240", "360", "480", "720", "1080"];
    const isValidFormat = format.every((f: string) => validFormats.includes(f));
    if (!isValidFormat) {
      res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "Invalid format. Valid formats: 144, 240, 360, 480, 720",
          ),
        );
      return;
    }

    const videoId = uuidv4();
    const s3Key = `uploads/${userId}/${videoId}-${filename}`;

    await db.insert(video).values({
      id: videoId,
      userId,
      s3Key,
      format,
      size,
      hlsIndexKey: "",
      status: "PENDING",
    });

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    res.status(201).json(
      new ApiResponse(
        201,
        {
          videoId,
          presignedUrl,
          s3Key,
          expiresIn: 3600,
        },
        "Video record created successfully",
      ),
    );
  },
);

const uploadComplete: RequestHandler = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json(new ApiResponse(401, null, "Unauthorized"));
      return;
    }

    const { videoId } = req.body;
    if (!videoId) {
      res
        .status(400)
        .json(new ApiResponse(400, null, "Missing required field: videoId"));
      return;
    }

    await db
      .update(video)
      .set({ status: "UPLOADING" })
      .where(and(eq(video.id, videoId), eq(video.userId, userId)));

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { status: "UPLOADING" },
          "Upload completed successfully",
        ),
      );
  },
);

const uploadFailure: RequestHandler = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json(new ApiResponse(401, null, "Unauthorized"));
      return;
    }

    const { videoId, error } = req.body;
    if (!videoId) {
      res
        .status(400)
        .json(new ApiResponse(400, null, "Missing required field: videoId"));
      return;
    }

    await db
      .delete(video)
      .where(and(eq(video.id, videoId), eq(video.userId, userId)));

    console.error(
      `Upload failed for user ${userId}, videoId: ${videoId}, error: ${error}`,
    );

    res
      .status(200)
      .json(
        new ApiResponse(200, null, "Upload failure recorded and video deleted"),
      );
  },
);

const updateVideo: RequestHandler = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json(new ApiResponse(401, null, "Unauthorized"));
      return;
    }

    const { videoId } = req.params;
    const { format } = req.body;

    if (!videoId || Array.isArray(videoId)) {
      res.status(400).json(new ApiResponse(400, null, "Invalid videoId param"));
      return;
    }

    if (!format || !Array.isArray(format)) {
      res
        .status(400)
        .json(
          new ApiResponse(400, null, "Missing required field: format (array)"),
        );
      return;
    }

    const validFormats = ["144", "240", "360", "480", "720"];
    const isValidFormat = format.every((f: string) => validFormats.includes(f));
    if (!isValidFormat) {
      res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "Invalid format. Valid formats: 144, 240, 360, 480, 720",
          ),
        );
      return;
    }

    await db
      .update(video)
      .set({ format })
      .where(and(eq(video.id, videoId), eq(video.userId, userId)));

    res
      .status(200)
      .json(new ApiResponse(200, { format }, "Format updated successfully"));
  },
);

const deleteVideo: RequestHandler = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json(new ApiResponse(401, null, "Unauthorized"));
      return;
    }

    const { videoId } = req.params;

    if (!videoId || Array.isArray(videoId)) {
      res.status(400).json(new ApiResponse(400, null, "Invalid videoId param"));
      return;
    }

    await db
      .delete(video)
      .where(and(eq(video.id, videoId), eq(video.userId, userId)));

    res
      .status(200)
      .json(new ApiResponse(200, null, "Video deleted successfully"));
  },
);

export { createVideo, uploadComplete, uploadFailure, updateVideo, deleteVideo };
