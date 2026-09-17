import AppDataSource from "../../../db/data-source";

/** FIFO realized P&L, including matched entry fees. Currency totals are never mixed. */
export function aggregateFillMetrics(fills:any[]) {
  const lots=new Map<string,{side:string;qty:number;price:number;feePerUnit:number}[]>();
  const orders=new Set<string>();
  const closed=new Map<string,{currency:string;pnl:number}>();
  const currencies=new Map<string,{currency:string;realizedPnl:number;feesComplete:boolean}>();
  const seen=new Set<string>();
  for(const f of [...fills].sort((a,b)=>Date.parse(a.executed_at)-Date.parse(b.executed_at)||Number(a.id)-Number(b.id))){
    const unique=`${f.account_id}:${f.fill_id}`;if(seen.has(unique))continue;seen.add(unique);
    const price=Number(f.fill_price),quantity=Number(f.fill_qty),fee=f.fee==null?0:Number(f.fee);
    if(!(price>0)||!(quantity>0)||!Number.isFinite(fee)||!f.currency||!["BUY","SELL"].includes(f.side))throw new Error("invalid_fill_metrics_record");
    const currency=String(f.currency);const total=currencies.get(currency)??{currency,realizedPnl:0,feesComplete:true};
    if(f.fee==null)total.feesComplete=false;
    const key=`${f.account_id}:${currency}:${f.symbol}`,orderKey=`${f.account_id}:${f.order_id}`;
    orders.add(orderKey);const queue=lots.get(key)??[];let remaining=quantity,pnl=0,closedQty=0,matchedEntryFees=0;
    while(remaining>1e-10&&queue.length&&queue[0].side!==f.side){
      const entry=queue[0],qty=Math.min(remaining,entry.qty);
      matchedEntryFees+=entry.feePerUnit*qty;
      pnl+=(price-entry.price)*qty*(entry.side==="BUY"?1:-1)-entry.feePerUnit*qty-fee*qty/quantity;
      remaining-=qty;entry.qty-=qty;closedQty+=qty;if(entry.qty<1e-10)queue.shift();
    }
    if(f.realized_pnl!=null){const realized=Number(f.realized_pnl);if(!Number.isFinite(realized))throw new Error("invalid_realized_pnl");pnl=realized-fee-matchedEntryFees;}
    if(remaining>1e-10)queue.push({side:f.side,qty:remaining,price,feePerUnit:fee/quantity});
    lots.set(key,queue);
    if(closedQty>0||(f.realized_pnl!=null&&Number(f.realized_pnl)!==0)){
      const result=closed.get(orderKey)??{currency,pnl:0};result.pnl+=pnl;closed.set(orderKey,result);total.realizedPnl+=pnl;
    }
    currencies.set(currency,total);
  }
  const trades=[...closed.values()];
  return {totalTrades:orders.size,closedTrades:trades.length,winRate:trades.length?100*trades.filter(t=>t.pnl>0).length/trades.length:null,currencies:[...currencies.values()]};
}
export async function getUserFillMetrics(userId:number) {
  const fills=await AppDataSource.query(`SELECT f.* FROM trade_fill_history f JOIN user_trading_accounts a ON a.id=f.account_id WHERE a.user_id=$1 ORDER BY f.executed_at,f.id`,[userId]);
  return aggregateFillMetrics(fills);
}
