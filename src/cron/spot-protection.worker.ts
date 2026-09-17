import {SpotProtectionService} from "../app/trade/services/spotProtection.service";
const watcher=new SpotProtectionService();
const tick=()=>void watcher.tick().catch(error=>console.error("[SPOT-PROTECTION]",error instanceof Error?error.message:"watch_failed"));
tick();
setInterval(tick,5000).unref();
