import { Router } from "express";
import { BrokerJobController } from "../controller/brokerJob.controller";
import { requireAuth, Roles } from "../../../../middleware/auth";

const router = Router();
const ctrl = new BrokerJobController();

router.post("/", requireAuth([Roles.USER, Roles.ADMIN]), ctrl.create.bind(ctrl));
router.get("/pending", requireAuth([Roles.ADMIN]), ctrl.listPending.bind(ctrl));
router.get("/credential/:credentialId", requireAuth([Roles.USER, Roles.ADMIN]), ctrl.listByCredential.bind(ctrl));
router.get("/:id", requireAuth([Roles.USER, Roles.ADMIN]), ctrl.get.bind(ctrl));
router.patch("/:id", requireAuth([Roles.USER, Roles.ADMIN]), ctrl.update.bind(ctrl));

export default router;
