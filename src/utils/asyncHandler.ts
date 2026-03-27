import type { Request, Response, NextFunction } from "express";

const asyncHandler =
  <TReq = Request, TRes = Response>(
    requestHandler: (
      req: TReq,
      res: TRes,
      next: NextFunction
    ) => Promise<any>
  ) =>
  (req: TReq, res: TRes, next: NextFunction): void => {
    Promise.resolve(requestHandler(req, res, next)).catch(next);
  };

export { asyncHandler };