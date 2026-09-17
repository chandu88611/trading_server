import AppDataSource from "../db/data-source";
import { CoinDCXStreams } from "../app/coindcx/services/coindcx.stream";
const streams = new CoinDCXStreams();
let busy = false;
const refresh = async () => { if (busy || !AppDataSource.isInitialized) return; busy=true; try { await streams.refresh(); } catch(error) { console.error("[COINDCX-STREAM] refresh failed", error); } finally { busy=false; } };
void refresh();
setInterval(refresh,30000).unref();
