// routes/mt5Listener.router.ts
import { Router } from "express";
import { Mt5ListenerDBServices } from "./mt5Listener.db";
import { Mt5ListenerServices } from "./mt5Listener.services";
import { Mt5ListenerController } from "./mt5Listener.controller";
import {AppDataSource as db} from "../../db/data-source";

 

export class Mt5ListenerRouter {
  private router: Router;

  constructor() {
    this.router = Router();

    const dbService = new Mt5ListenerDBServices(db);
    const service = new Mt5ListenerServices(dbService);
    const controller = new Mt5ListenerController(service);

    this.router.get("/", controller.listenSignal.bind(controller));
    this.router.post("/ack", controller.ackListenSignal.bind(controller));
    this.router.post("/state", controller.stateListenSignal.bind(controller));
  }

  getRouter() {
    return this.router;
  }
}
