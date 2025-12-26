import { Router } from "express";
import { AlertSnapshotController } from "../controller/alertSnapshot.controller";
import { requireAuth, Roles } from "../../../../middleware/auth";
import { authFromQueryToken } from "../../../../middleware/authFromQuery";

const ctrl = new AlertSnapshotController();
const router = Router();

router.post(
  "/",
  authFromQueryToken,
  requireAuth([Roles.USER, Roles.ADMIN]),
  ctrl.create.bind(ctrl)
);

router.get(
  "/history",
  requireAuth([Roles.USER, Roles.ADMIN]),
  ctrl.getHistory.bind(ctrl)
);

router.get(
  "/timeline",
  requireAuth([Roles.USER, Roles.ADMIN]),
  ctrl.getTimeline.bind(ctrl)
);

router.get(
  "/jobs/open",
  requireAuth([Roles.USER, Roles.ADMIN]),
  ctrl.getOpenJobs.bind(ctrl)
);

router.get(
  "/job/:jobId",
  requireAuth([Roles.USER, Roles.ADMIN]),
  ctrl.listByJob.bind(ctrl)
);

export default router;
