import { Router } from "express";
import { AlertSnapshotController } from "../controller/alertSnapshot.controller";
import { requireAuth, Roles } from "../../../../middleware/auth";

const ctrl = new AlertSnapshotController();
const router = Router();

router.post(
  "/",
  requireAuth([Roles.USER, Roles.ADMIN]),
  ctrl.create.bind(ctrl)
);
router.get(
  "/job/:jobId",
  requireAuth([Roles.USER, Roles.ADMIN]),
  ctrl.listByJob.bind(ctrl)
);

export default router;
