import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import type { Request, Response, RequestHandler } from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET_NAME } from "../config/s3.config.js";
import { db } from "../db/db.js";
import { video } from "../db/schema/video.js";
import { v4 as uuidv4 } from "uuid";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const getPresignedUrl: RequestHandler = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json(new ApiResponse(401, null, "Unauthorized"));
      return;
    }

    const { filename, contentType, size } = req.body;
    if (!filename || !contentType || !size) {
      res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "Missing required fields: filename, contentType, size",
          ),
        );
      return;
    }

    const s3Key = `uploads/${userId}/${uuidv4()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          presignedUrl,
          s3Key,
          expiresIn: 3600,
        },
        "Presigned URL generated successfully",
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

    const { s3Key, format, size } = req.body;
    if (!s3Key || !size) {
      res
        .status(400)
        .json(
          new ApiResponse(400, null, "Missing required fields: s3Key, size"),
        );
      return;
    }

    const videoId = uuidv4();

    await db.insert(video).values({
      id: videoId,
      userId,
      s3Key,
      format: format || [],
      size,
      hlsIndexKey: "",
      status: "PENDING",
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { videoId, status: "PENDING" },
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

    const { s3Key, error } = req.body;

    console.error(
      `Upload failed for user ${userId}, key: ${s3Key}, error: ${error}`,
    );

    res.status(200).json(new ApiResponse(200, null, "Upload failure recorded"));
  },
);

export { getPresignedUrl, uploadComplete, uploadFailure };
