import { Router } from "express";
import { BrokerCredentialController } from "../controller/brokerCredential.controller";
import { requireAuth, Roles } from "../../../../middleware/auth";

const ctrl = new BrokerCredentialController();
const router = Router();

router.post("/", requireAuth([Roles.USER]), ctrl.create.bind(ctrl));
router.get(
  "/user/:userId",
  requireAuth([Roles.ADMIN, Roles.USER]),
  ctrl.listByUser.bind(ctrl)
);
router.get("/:id", requireAuth([Roles.ADMIN, Roles.USER]), ctrl.get.bind(ctrl));
router.patch(
  "/:id",
  requireAuth([Roles.USER, Roles.ADMIN]),
  ctrl.update.bind(ctrl)
);
router.delete(
  "/:id",
  requireAuth([Roles.USER, Roles.ADMIN]),
  ctrl.remove.bind(ctrl)
);

export default router;
