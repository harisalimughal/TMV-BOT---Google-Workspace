import { Request, Response, Router } from "express";
import { getDriveFileMedia } from "../../../src/google/drive";
import { log } from "../../../src/utils/logger";

const FILE_ID_REGEX = /^[A-Za-z0-9_-]{10,100}$/;

export function photosRoute(): Router {
  const router = Router();

  router.get("/:jobId/photos/:fileId", async (req: Request, res: Response) => {
    const fileId = String(req.params.fileId || "").trim();
    const jobId = String(req.params.jobId || "").trim();

    if (!FILE_ID_REGEX.test(fileId)) {
      return res.status(400).json({
        error: { code: "INVALID_FILE_ID", message: "Malformed file ID." }
      });
    }

    try {
      const { buffer, contentType } = await getDriveFileMedia(fileId);
      res.setHeader("Content-Type", contentType || "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.status(200).send(buffer);
    } catch (error) {
      log.warn("drive photo proxy failed to load media", { file_id: fileId, job_id: jobId, error: String(error) });
      return res.status(404).json({
        error: { code: "PHOTO_NOT_FOUND", message: "Photograph could not be retrieved from Drive." }
      });
    }
  });

  return router;
}
