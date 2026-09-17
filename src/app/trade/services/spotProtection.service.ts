import AppDataSource from "../../../db/data-source";
import { CoinDCXService } from "../../coindcx/services/coindcx.service";

export function spotProtectionTrigger(position:any,price:number):"SL"|"TP"|null {
  if (!Number.isFinite(price)||price<=0||String(position.action).toUpperCase()!=="BUY") return null;
  const sl=Number(position.stop_loss),tp=Number(position.take_profit);
  if(sl>0 && price<=sl) return "SL";
  if(tp>0 && price>=tp) return "TP";
  return null;
}
/** Ticker cache is process-local; a conditional DB transition prevents duplicate closes across workers. */
export class SpotProtectionService {
  private running=false;
  async tick() {
    if(this.running)return;
    this.running=true;
    try {
      const positions=await AppDataSource.query(`SELECT t.id,t.symbol,t.action,t.stop_loss,t.take_profit FROM trade_signals t JOIN trade_signals_status s ON s.signal_id=t.id JOIN user_trading_accounts a ON a.id=t.trading_account_id JOIN brokers b ON b.id=a.broker_id WHERE b.code='COINDCX' AND s.status='completed' AND t.execution_state='FILLED' AND UPPER(t.action)='BUY' AND t.broker_order_id IS NOT NULL AND t.broker_close_order_id IS NULL AND COALESCE(t.instrument_type,'')<>'FUTURES' AND t.symbol NOT LIKE 'B-%' AND t.symbol NOT LIKE 'BM-%' AND (t.stop_loss>0 OR t.take_profit>0)`);
      if(!positions.length)return;
      const tickers=await new CoinDCXService().getPublicTicker({});
      if(!Array.isArray(tickers))throw new Error("spot_ticker_unavailable");
      const now=Date.now();
      const prices=new Map<string,number>();
      for(const ticker of tickers){
        let timestamp=Number(ticker.timestamp);
        if(timestamp<1e12) timestamp*=1000;
        if(!Number.isFinite(timestamp)||now-timestamp>30000||timestamp>now+5000)continue;
        prices.set(String(ticker.market).toUpperCase(),Number(ticker.last_price));
      }
      for(const position of positions){
        const trigger=spotProtectionTrigger(position,prices.get(String(position.symbol).replace(/[^A-Za-z0-9]/g,"").toUpperCase())??NaN);
        if(!trigger)continue;
        await AppDataSource.query(`UPDATE trade_signals_status SET status='pending_close',last_error=NULL,next_retry_at=NULL,updated_at=now() WHERE signal_id=$1 AND status='completed'`,[position.id]);
      }
    } finally {this.running=false;}
  }
}
