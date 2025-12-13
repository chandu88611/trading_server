import { Router } from "express";
import { BrokerSessionController } from "../controller/brokerSession.controller";
import { requireAuth, Roles } from "../../../../middleware/auth";

const ctrl = new BrokerSessionController();
const router = Router();

router.post("/", requireAuth([Roles.USER]), ctrl.create.bind(ctrl));
router.get("/valid/:credentialId", requireAuth([Roles.USER, Roles.ADMIN]), ctrl.listValid.bind(ctrl));
router.post("/revoke-all/:credentialId", requireAuth([Roles.USER, Roles.ADMIN]), ctrl.revokeAll.bind(ctrl));

export default router;
