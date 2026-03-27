import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import type { Request, Response, RequestHandler } from "express";

const healthcheck: RequestHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res
      .status(200)
      .json(new ApiResponse(200, { status: "OK" }, "Health check passed"));
  },
);

export { healthcheck };
