import { Router } from "express";
import { requireAuth, Roles } from "../../middleware/auth";
import { CopyExecutionController } from "./copyExecution.controller";

const router = Router();
const controller = new CopyExecutionController();

router.use(requireAuth([Roles.USER]));

router.get("/symbols", controller.searchSymbols.bind(controller));
router.get("/strategies", controller.listStrategies.bind(controller));
router.get("/links", controller.listLinks.bind(controller));
router.post("/links", controller.upsertLink.bind(controller));
router.delete("/links/:strategyId", controller.deleteLink.bind(controller));
router.post("/manual-trade", controller.manualTrade.bind(controller));

export default router;
