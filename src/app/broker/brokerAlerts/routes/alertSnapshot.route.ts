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


export default router;
