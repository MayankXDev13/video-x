import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import type { Response, RequestHandler } from "express";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET_NAME } from "../config/s3.config.js";
import { db } from "../db/db.js";
import { video, videoFormat } from "../db/schema/video.js";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const VALID_FORMATS = ["144", "240", "360", "480", "720"] as const;
const VALID_CONTENT_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
] as const;
type VideoFormat = (typeof videoFormat)["enumValues"];

const createVideo: RequestHandler = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json(new ApiResponse(401, null, "Unauthorized"));
      return;
    }

    const { filename, contentType, size, format } = req.body;

    if (!filename || typeof filename !== "string") {
      res
        .status(400)
        .json(new ApiResponse(400, null, "Missing required field: filename"));
      return;
    }

    if (!contentType || typeof contentType !== "string") {
      res
        .status(400)
        .json(
          new ApiResponse(400, null, "Missing required field: contentType"),
        );
      return;
    }

    if (
      !VALID_CONTENT_TYPES.includes(
        contentType as (typeof VALID_CONTENT_TYPES)[number],
      )
    ) {
      res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            `Invalid contentType. Allowed types: ${VALID_CONTENT_TYPES.join(", ")}`,
          ),
        );
      return;
    }

    if (typeof size !== "number" || size <= 0) {
      res
        .status(400)
        .json(
          new ApiResponse(400, null, "Invalid size; must be a positive number"),
        );
      return;
    }

    if (!Array.isArray(format) || format.length === 0) {
      res
        .status(400)
        .json(
          new ApiResponse(400, null, "Missing required field: format (array)"),
        );
      return;
    }

    const formats = format.map((f: unknown) => String(f));
    const isValidFormat = formats.every((f) =>
      VALID_FORMATS.includes(f as (typeof VALID_FORMATS)[number]),
    );
    if (!isValidFormat) {
      res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            `Invalid format. Valid formats: ${VALID_FORMATS.join(", ")}`,
          ),
        );
      return;
    }

    const videoId = uuidv4();
    const s3Key = `uploads/${userId}/${videoId}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    await db.insert(video).values({
      userId,
      s3Key,
      format: formats as any,
      size,
      hlsIndexKey: "",
      status: "PENDING",
    } as any);

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

    const result = await db
      .update(video)
      .set({ status: "PROCESSING" })
      .where(and(eq(video.id, videoId), eq(video.userId, userId)));

    if (result.rowCount === 0) {
      res.status(404).json(new ApiResponse(404, null, "Video not found"));
      return;
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { status: "PROCESSING" },
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

    const result = await db
      .update(video)
      .set({ status: "FAILED" })
      .where(and(eq(video.id, videoId), eq(video.userId, userId)));

    if (result.rowCount === 0) {
      res.status(404).json(new ApiResponse(404, null, "Video not found"));
      return;
    }

    console.error(
      `Upload failed for user ${userId}, videoId: ${videoId}, error: ${error}`,
    );

    res
      .status(200)
      .json(
        new ApiResponse(200, { status: "FAILED" }, "Upload failure recorded"),
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

    if (!format || !Array.isArray(format) || format.length === 0) {
      res
        .status(400)
        .json(
          new ApiResponse(400, null, "Missing required field: format (array)"),
        );
      return;
    }

    const formats = format.map((f: unknown) => String(f));
    const isValidFormat = formats.every((f) =>
      VALID_FORMATS.includes(f as (typeof VALID_FORMATS)[number]),
    );
    if (!isValidFormat) {
      res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            `Invalid format. Valid formats: ${VALID_FORMATS.join(", ")}`,
          ),
        );
      return;
    }

    const result = await db
      .update(video)
      .set({ format: formats as any })
      .where(and(eq(video.id, videoId), eq(video.userId, userId)));

    if (result.rowCount === 0) {
      res.status(404).json(new ApiResponse(404, null, "Video not found"));
      return;
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { format: formats },
          "Format updated successfully",
        ),
      );
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

    const result = await db
      .delete(video)
      .where(and(eq(video.id, videoId), eq(video.userId, userId)));

    if (result.rowCount === 0) {
      res.status(404).json(new ApiResponse(404, null, "Video not found"));
      return;
    }

    res
      .status(200)
      .json(new ApiResponse(200, null, "Video deleted successfully"));
  },
);

export { createVideo, uploadComplete, uploadFailure, updateVideo, deleteVideo };
