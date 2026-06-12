//+------------------------------------------------------------------+
//|                                                   SignalPollerEA |
//| Polls TradeBro REST signals and executes MT5 core order actions  |
//+------------------------------------------------------------------+
#property strict
#property version "3.00"

#include <Trade/Trade.mqh>

input string BaseUrl           = "https://backend.tradebro.io";  // Server base URL (no trailing slash)
input string PollKey           = "";           // X-Poll-Key secret from your TradeBro account
input int    PollSeconds       = 1;            // Poll interval (seconds). Min=1
input int    PositionSyncSeconds = 10;         // How often to push symbol/position state
input double DefaultLots       = 0.10;         // Default lot size when signal has no qty
input bool   MasterEnable      = true;         // Set false to disable trade execution
input string UserId            = "";           // Override MT5 login as userId (leave blank = auto)
input long   MagicNumber       = 260509;
input int    MaxDeviationPoints = 20;
input int    HttpTimeoutMs     = 5000;
input string ExtraSymbolsCsv   = "";           // Extra symbols to push in state sync (CSV)

// Derived URL strings — built at OnInit from BaseUrl
string g_signalUrl = "";
string g_ackUrl    = "";
string g_stateUrl  = "";

CTrade trade;
long   g_lastAckId    = -1;
bool   g_paused       = false;
datetime g_lastSyncTime = 0;
string g_userId       = "";

// ------------------------------------------------------------------
// JSON helpers for flat API payloads
// ------------------------------------------------------------------
int JsonValueStart(const string json, const string key)
{
   string pattern = "\"" + key + "\"";
   int pos = StringFind(json, pattern);
   if(pos < 0) return -1;

   pos = StringFind(json, ":", pos + StringLen(pattern));
   if(pos < 0) return -1;
   pos++;

   int len = StringLen(json);
   while(pos < len)
   {
      int ch = StringGetCharacter(json, pos);
      if(ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n')
      {
         pos++;
         continue;
      }
      break;
   }
   return pos;
}

string JsonGetString(const string json, const string key)
{
   int pos = JsonValueStart(json, key);
   if(pos < 0) return "";
   if(StringGetCharacter(json, pos) != '"') return "";
   pos++;

   string out = "";
   int len = StringLen(json);
   bool escaping = false;

   for(int i = pos; i < len; i++)
   {
      int ch = StringGetCharacter(json, i);
      if(escaping)
      {
         if(ch == '"' || ch == '\\' || ch == '/')
            out += ShortToString((ushort)ch);
         else if(ch == 'n')
            out += "\n";
         else if(ch == 'r')
            out += "\r";
         else if(ch == 't')
            out += "\t";
         else
            out += ShortToString((ushort)ch);
         escaping = false;
         continue;
      }
      if(ch == '\\')
      {
         escaping = true;
         continue;
      }
      if(ch == '"') return out;
      out += ShortToString((ushort)ch);
   }
   return "";
}

double JsonGetNumber(const string json, const string key, const double def_value)
{
   int pos = JsonValueStart(json, key);
   if(pos < 0) return def_value;

   int len = StringLen(json);
   if(pos < len && StringGetCharacter(json, pos) == '"')
   {
      string quoted = JsonGetString(json, key);
      if(quoted == "") return def_value;
      return (double)StringToDouble(quoted);
   }

   int start = pos;
   while(pos < len)
   {
      int ch = StringGetCharacter(json, pos);
      if((ch >= '0' && ch <= '9') || ch == '-' || ch == '+' ||
         ch == '.' || ch == 'e' || ch == 'E')
      {
         pos++;
         continue;
      }
      break;
   }

   if(pos <= start) return def_value;
   return (double)StringToDouble(StringSubstr(json, start, pos - start));
}

long JsonGetLong(const string json, const string key, const long def_value)
{
   string asString = JsonGetString(json, key);
   if(asString != "")
      return (long)StringToInteger(asString);

   double number = JsonGetNumber(json, key, (double)def_value);
   return (long)number;
}

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\r", "\\r");
   StringReplace(value, "\n", "\\n");
   StringReplace(value, "\t", "\\t");
   return value;
}

// ------------------------------------------------------------------
// HTTP helpers — include X-Poll-Key on every request
// ------------------------------------------------------------------
string BuildAuthHeaders()
{
   string h = "Content-Type: application/json\r\n";
   h += "Accept: application/json\r\n";
   if(StringLen(PollKey) > 0)
      h += "X-Poll-Key: " + PollKey + "\r\n";
   return h;
}

bool HttpGet(const string url, string &response_out)
{
   char data[];
   char result[];
   string result_headers;
   string headers = BuildAuthHeaders();

   ResetLastError();
   int res = WebRequest("GET", url, headers, HttpTimeoutMs, data, result, result_headers);
   if(res == -1)
   {
      int err = GetLastError();
      if(err == 4014)
         Print("WebRequest blocked. Add URL in Tools -> Options -> Expert Advisors: ", url);
      else
         Print("HttpGet WebRequest failed. Error=", err, " Url=", url);
      return false;
   }

   if(res < 200 || res >= 300)
   {
      Print("HttpGet returned HTTP ", res, " Url=", url);
      return false;
   }

   response_out = CharArrayToString(result, 0, -1, CP_UTF8);
   return true;
}

bool HttpPostJson(const string url, const string body, string &response_out)
{
   char data[];
   char result[];
   string result_headers;
   string headers = BuildAuthHeaders();

   int body_len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(body_len > 0) body_len--;
   if(body_len < 0) body_len = 0;
   ArrayResize(data, body_len);

   ResetLastError();
   int res = WebRequest("POST", url, headers, HttpTimeoutMs, data, result, result_headers);
   if(res == -1)
   {
      Print("HttpPostJson WebRequest failed. Error=", GetLastError(), " Url=", url);
      return false;
   }

   response_out = CharArrayToString(result, 0, -1, CP_UTF8);
   if(res < 200 || res >= 300)
   {
      Print("HttpPostJson returned HTTP ", res, " Url=", url, " body=", response_out);
      return false;
   }
   return true;
}

string SignalPollUrl()
{
   string separator = StringFind(g_signalUrl, "?") >= 0 ? "&" : "?";
   return g_signalUrl + separator + "userId=" + g_userId;
}

string AckPollUrl()
{
   string separator = StringFind(g_ackUrl, "?") >= 0 ? "&" : "?";
   return g_ackUrl + separator + "userId=" + g_userId;
}

string StatePollUrl()
{
   string separator = StringFind(g_stateUrl, "?") >= 0 ? "&" : "?";
   return g_stateUrl + separator + "userId=" + g_userId;
}

// ------------------------------------------------------------------
// ACK and persistence
// ------------------------------------------------------------------
string LastAckGlobalName()
{
   return "TradeBro.MT5.LastAck." +
          IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN)) + "." +
          IntegerToString(MagicNumber);
}

void LoadLastAck()
{
   string name = LastAckGlobalName();
   if(GlobalVariableCheck(name))
      g_lastAckId = (long)GlobalVariableGet(name);
}

void MarkHandled(const long ackId)
{
   if(ackId <= g_lastAckId) return;
   g_lastAckId = ackId;
   GlobalVariableSet(LastAckGlobalName(), (double)ackId);
}

bool SendAck(const long ackId,
             const string status,
             const string message,
             const ulong ticket,
             const int retcode,
             const string side = "",
             const string executionMode = "",
             const string symbol = "",
             const string orderType = "",
             const ulong orderId = 0,
             const ulong brokerOrderId = 0,
             const ulong brokerPositionId = 0,
             const ulong dealId = 0)
{
   if(ackId < 0) return true;

   string json = "{";
   json += "\"ackId\":" + IntegerToString(ackId) + ",";
   json += "\"status\":\"" + JsonEscape(status) + "\",";
   json += "\"ticket\":" + IntegerToString((long)ticket) + ",";
   json += "\"orderId\":" + IntegerToString((long)orderId) + ",";
   json += "\"brokerOrderId\":" + IntegerToString((long)brokerOrderId) + ",";
   json += "\"brokerPositionId\":" + IntegerToString((long)brokerPositionId) + ",";
   json += "\"positionTicket\":" + IntegerToString((long)brokerPositionId) + ",";
   json += "\"dealId\":" + IntegerToString((long)dealId) + ",";
   json += "\"retcode\":" + IntegerToString(retcode) + ",";
   json += "\"account_login\":" + IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN)) + ",";
   json += "\"userId\":\"" + JsonEscape(g_userId) + "\",";
   json += "\"side\":\"" + JsonEscape(side) + "\",";
   json += "\"executionMode\":\"" + JsonEscape(executionMode) + "\",";
   json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
   json += "\"orderType\":\"" + JsonEscape(orderType) + "\",";
   json += "\"message\":\"" + JsonEscape(message) + "\"";
   json += "}";

   string resp;
   bool ok = HttpPostJson(AckPollUrl(), json, resp);
   if(!ok)
      Print("SendAck failed ackId=", ackId, " payload=", json);
   else
      Print("SendAck ok ackId=", ackId, " resp=", resp);
   return ok;
}

// ------------------------------------------------------------------
// Symbol and state sync
// ------------------------------------------------------------------
void AddUniqueSymbol(string &symbols[], int &count, string symbol)
{
   StringTrimLeft(symbol);
   StringTrimRight(symbol);
   if(symbol == "") return;

   for(int i = 0; i < count; i++)
   {
      if(symbols[i] == symbol)
         return;
   }

   ArrayResize(symbols, count + 1);
   symbols[count] = symbol;
   count++;
}

double ResolvePipSize(const string symbol)
{
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(point <= 0.0) return 0.0;
   if(digits == 3 || digits == 5) return point * 10.0;
   return point;
}

string BuildSymbolSpecsJson()
{
   string symbols[];
   int count = 0;

   AddUniqueSymbol(symbols, count, _Symbol);

   string parts[];
   int partCount = StringSplit(ExtraSymbolsCsv, ',', parts);
   for(int i = 0; i < partCount; i++)
      AddUniqueSymbol(symbols, count, parts[i]);

   int total = PositionsTotal();
   for(int p = 0; p < total; p++)
   {
      ulong ticket = PositionGetTicket(p);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      AddUniqueSymbol(symbols, count, PositionGetString(POSITION_SYMBOL));
   }

   string json = "[";
   int emitted = 0;
   for(int s = 0; s < count; s++)
   {
      string symbol = symbols[s];
      if(SymbolInfoInteger(symbol, SYMBOL_SELECT) == 0)
         SymbolSelect(symbol, true);

      double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
      double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
      double pipSize = ResolvePipSize(symbol);
      int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

      if(point <= 0.0)
         continue;

      if(emitted > 0) json += ",";
      json += "{";
      json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
      json += "\"digits\":" + IntegerToString(digits) + ",";
      json += "\"point\":" + DoubleToString(point, digits + 2) + ",";
      json += "\"tickSize\":" + DoubleToString(tickSize, digits + 2) + ",";
      json += "\"pipSize\":" + DoubleToString(pipSize, digits + 2);
      json += "}";
      emitted++;
   }
   json += "]";
   return json;
}

string BuildPositionsJson()
{
   string json = "[";
   int emitted = 0;
   int total = PositionsTotal();

   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;

      string symbol = PositionGetString(POSITION_SYMBOL);
      long type = PositionGetInteger(POSITION_TYPE);
      double volume = PositionGetDouble(POSITION_VOLUME);
      double priceOpen = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);
      double profit = PositionGetDouble(POSITION_PROFIT);
      long magic = PositionGetInteger(POSITION_MAGIC);
      string comment = PositionGetString(POSITION_COMMENT);
      int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

      if(emitted > 0) json += ",";
      json += "{";
      json += "\"ticket\":" + IntegerToString((long)ticket) + ",";
      json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
      json += "\"type\":\"" + (type == POSITION_TYPE_BUY ? "buy" : "sell") + "\",";
      json += "\"volume\":" + DoubleToString(volume, 2) + ",";
      json += "\"price_open\":" + DoubleToString(priceOpen, digits) + ",";
      json += "\"sl\":" + DoubleToString(sl, digits) + ",";
      json += "\"tp\":" + DoubleToString(tp, digits) + ",";
      json += "\"profit\":" + DoubleToString(profit, 2) + ",";
      json += "\"magic\":" + IntegerToString(magic) + ",";
      json += "\"comment\":\"" + JsonEscape(comment) + "\"";
      json += "}";
      emitted++;
   }

   json += "]";
   return json;
}

void SyncState()
{
   if(PositionSyncSeconds <= 0) return;

   datetime nowTime = TimeCurrent();
   if(g_lastSyncTime != 0 && (nowTime - g_lastSyncTime) < PositionSyncSeconds)
      return;

   g_lastSyncTime = nowTime;

   string specs = BuildSymbolSpecsJson();
   string accCurrency = AccountInfoString(ACCOUNT_CURRENCY);
   string json = "{";
   json += "\"brokerAccountId\":\"" + JsonEscape(g_userId) + "\",";
   json += "\"userId\":\"" + JsonEscape(g_userId) + "\",";
   json += "\"account_login\":" + IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN)) + ",";
   json += "\"account_balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   json += "\"account_equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   json += "\"account_margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2) + ",";
   json += "\"account_free_margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + ",";
   json += "\"account_currency\":\"" + JsonEscape(accCurrency) + "\",";
   json += "\"items\":" + specs + ",";
   json += "\"symbolSpecs\":" + specs + ",";
   json += "\"positions\":" + BuildPositionsJson();
   json += "}";

   string resp;
   bool ok = HttpPostJson(StatePollUrl(), json, resp);
   if(!ok)
      Print("SyncState failed");
   else
      Print("SyncState ok resp=", resp);
}

// ------------------------------------------------------------------
// Trading helpers
// ------------------------------------------------------------------
bool IsTradeSuccessRetcode(const int retcode)
{
   return retcode == TRADE_RETCODE_DONE ||
          retcode == TRADE_RETCODE_PLACED ||
          retcode == TRADE_RETCODE_DONE_PARTIAL;
}

string NormalizeOrderType(string value)
{
   StringTrimLeft(value);
   StringTrimRight(value);
   StringToUpper(value);
   if(value == "" || value == "MKT") return "MARKET";
   if(value == "LMT") return "LIMIT";
   if(value == "STP") return "STOP";
   if(value == "STOPLIMIT") return "STOP_LIMIT";
   if(value == "MARKETRANGE") return "MARKET_RANGE";
   return value;
}

bool EnsureSymbol(const string symbol, string &message)
{
   if(symbol == "")
   {
      message = "missing_symbol";
      return false;
   }

   if(SymbolInfoInteger(symbol, SYMBOL_SELECT) == 0)
   {
      if(!SymbolSelect(symbol, true))
      {
         message = "cannot_select_symbol=" + symbol;
         return false;
      }
   }
   return true;
}

double NormalizeVolume(const string symbol, double lots)
{
   if(lots <= 0.0) lots = DefaultLots;

   double minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);

   if(step > 0.0)
      lots = MathFloor(lots / step) * step;
   if(minLot > 0.0 && lots < minLot)
      lots = minLot;
   if(maxLot > 0.0 && lots > maxLot)
      lots = maxLot;

   int volumeDigits = 2;
   if(step > 0.0)
   {
      volumeDigits = 0;
      double probe = step;
      while(probe < 1.0 && volumeDigits < 8)
      {
         probe *= 10.0;
         volumeDigits++;
      }
   }

   return NormalizeDouble(lots, volumeDigits);
}

double NormalizePrice(const string symbol, const double price)
{
   if(price <= 0.0) return 0.0;
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   return NormalizeDouble(price, digits);
}

double ResolveTradePrice(const string symbol,
                         const bool isBuy,
                         const string orderType,
                         const double signalPrice,
                         const double limitPrice,
                         const double stopPrice)
{
   if(orderType == "LIMIT")
      return NormalizePrice(symbol, limitPrice > 0.0 ? limitPrice : signalPrice);
   if(orderType == "STOP")
      return NormalizePrice(symbol, stopPrice > 0.0 ? stopPrice : signalPrice);

   MqlTick tick;
   if(SymbolInfoTick(symbol, tick))
      return NormalizePrice(symbol, isBuy ? tick.ask : tick.bid);

   return NormalizePrice(symbol, signalPrice);
}

void ResolveStops(const string symbol,
                  const bool isBuy,
                  const double basisPrice,
                  const double absoluteSl,
                  const double absoluteTp,
                  const double slDistance,
                  const double tpDistance,
                  double &sl,
                  double &tp)
{
   sl = 0.0;
   tp = 0.0;

   if(absoluteSl > 0.0)
      sl = absoluteSl;
   else if(slDistance > 0.0 && basisPrice > 0.0)
      sl = isBuy ? basisPrice - slDistance : basisPrice + slDistance;

   if(absoluteTp > 0.0)
      tp = absoluteTp;
   else if(tpDistance > 0.0 && basisPrice > 0.0)
      tp = isBuy ? basisPrice + tpDistance : basisPrice - tpDistance;

   sl = NormalizePrice(symbol, sl);
   tp = NormalizePrice(symbol, tp);
}

bool FindLatestPositionTicket(const string symbol, const bool isBuy, const ulong preferredOrder, ulong &positionTicket)
{
   positionTicket = 0;
   long bestTime = -1;
   long wantedType = isBuy ? POSITION_TYPE_BUY : POSITION_TYPE_SELL;

   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;

      if(PositionGetString(POSITION_SYMBOL) != symbol)
         continue;
      if(PositionGetInteger(POSITION_TYPE) != wantedType)
         continue;
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber)
         continue;

      ulong identifier = (ulong)PositionGetInteger(POSITION_IDENTIFIER);
      if(ticket == preferredOrder || identifier == preferredOrder)
      {
         positionTicket = ticket;
         return true;
      }

      long positionTime = (long)PositionGetInteger(POSITION_TIME_MSC);
      if(positionTime >= bestTime)
      {
         bestTime = positionTime;
         positionTicket = ticket;
      }
   }

   return positionTicket > 0;
}

int CountPositionsBySymbol(const string symbol, ulong &singleTicket)
{
   int count = 0;
   singleTicket = 0;

   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;

      if(PositionGetString(POSITION_SYMBOL) != symbol)
         continue;

      count++;
      singleTicket = ticket;
   }
   return count;
}

bool IsHedgingAccount()
{
   long mode = AccountInfoInteger(ACCOUNT_MARGIN_MODE);
   return mode == ACCOUNT_MARGIN_MODE_RETAIL_HEDGING;
}

void ExecuteCloseSignal(const long ackId, const string body)
{
   string symbol = JsonGetString(body, "symbol");
   long ticketRaw = JsonGetLong(body, "ticket", -1);
   if(ticketRaw <= 0) ticketRaw = JsonGetLong(body, "brokerPositionId", -1);
   if(ticketRaw <= 0) ticketRaw = JsonGetLong(body, "positionTicket", -1);
   if(ticketRaw <= 0) ticketRaw = JsonGetLong(body, "brokerOrderId", -1);
   if(ticketRaw <= 0) ticketRaw = JsonGetLong(body, "orderId", -1);

   ulong ticket = ticketRaw > 0 ? (ulong)ticketRaw : 0;
   bool ok = false;
   int retcode = 0;

   if(ticket > 0)
   {
      if(PositionSelectByTicket(ticket))
      {
         symbol = PositionGetString(POSITION_SYMBOL);
         ok = trade.PositionClose(ticket, MaxDeviationPoints);
         retcode = trade.ResultRetcode();
         if(ok && IsTradeSuccessRetcode(retcode))
         {
            SendAck(ackId, "success", "CLOSE SUCCESS ticket=" + IntegerToString((long)ticket),
                    ticket, retcode, "close", "CLOSE", symbol, "", ticket, 0, ticket, trade.ResultDeal());
         }
         else
         {
            SendAck(ackId, "error",
                    "CLOSE FAILED ticket=" + IntegerToString((long)ticket) +
                    " retcode=" + IntegerToString(retcode) +
                    " desc=" + trade.ResultRetcodeDescription(),
                    ticket, retcode, "close", "CLOSE", symbol, "", ticket, 0, ticket, trade.ResultDeal());
         }
         MarkHandled(ackId);
         return;
      }

      if(OrderSelect(ticket))
      {
         symbol = OrderGetString(ORDER_SYMBOL);
         ok = trade.OrderDelete(ticket);
         retcode = trade.ResultRetcode();
         if(ok && IsTradeSuccessRetcode(retcode))
         {
            SendAck(ackId, "success", "ORDER DELETE SUCCESS ticket=" + IntegerToString((long)ticket),
                    ticket, retcode, "close", "CLOSE", symbol, "", ticket, ticket, 0, trade.ResultDeal());
         }
         else
         {
            SendAck(ackId, "error",
                    "ORDER DELETE FAILED ticket=" + IntegerToString((long)ticket) +
                    " retcode=" + IntegerToString(retcode) +
                    " desc=" + trade.ResultRetcodeDescription(),
                    ticket, retcode, "close", "CLOSE", symbol, "", ticket, ticket, 0, trade.ResultDeal());
         }
         MarkHandled(ackId);
         return;
      }

      if(symbol == "")
      {
         SendAck(ackId, "error", "CLOSE failed: no position or pending order for ticket=" + IntegerToString((long)ticket),
                 ticket, 0, "close", "CLOSE", symbol, "", ticket, 0, ticket, 0);
         MarkHandled(ackId);
         return;
      }

      Print("Close ticket ", IntegerToString((long)ticket),
            " was not an open position or pending order; falling back to safe symbol close for ", symbol);
   }

   string symbolMessage = "";
   if(!EnsureSymbol(symbol, symbolMessage))
   {
      SendAck(ackId, "error", "CLOSE failed: " + symbolMessage, 0, 0, "close", "CLOSE", symbol);
      MarkHandled(ackId);
      return;
   }

   ulong singleTicket = 0;
   int matching = CountPositionsBySymbol(symbol, singleTicket);
   if(matching <= 0)
   {
      SendAck(ackId, "skipped", "CLOSE skipped: no open position on " + symbol,
              0, 0, "close", "CLOSE", symbol);
      MarkHandled(ackId);
      return;
   }

   if(IsHedgingAccount() && matching > 1)
   {
      SendAck(ackId, "error", "CLOSE unsafe: multiple hedging positions on " + symbol + " and no ticket",
              0, 0, "close", "CLOSE", symbol);
      MarkHandled(ackId);
      return;
   }

   ok = trade.PositionClose(singleTicket, MaxDeviationPoints);
   retcode = trade.ResultRetcode();
   if(ok && IsTradeSuccessRetcode(retcode))
   {
      SendAck(ackId, "success", "CLOSE SUCCESS symbol=" + symbol,
              singleTicket, retcode, "close", "CLOSE", symbol, "", singleTicket, 0, singleTicket, trade.ResultDeal());
   }
   else
   {
      SendAck(ackId, "error",
              "CLOSE FAILED symbol=" + symbol +
              " retcode=" + IntegerToString(retcode) +
              " desc=" + trade.ResultRetcodeDescription(),
              singleTicket, retcode, "close", "CLOSE", symbol, "", singleTicket, 0, singleTicket, trade.ResultDeal());
   }
   MarkHandled(ackId);
}

void ExecuteOpenSignal(const long ackId, const string body)
{
   string symbol = JsonGetString(body, "symbol");
   if(symbol == "") symbol = _Symbol;

   string side = JsonGetString(body, "side");
   StringToLower(side);

   bool isBuy = side == "buy" || side == "long";
   bool isSell = side == "sell" || side == "short";
   if(!isBuy && !isSell)
   {
      SendAck(ackId, "error", "Invalid side. Expected buy/sell/long/short/close.",
              0, 0, side, "OPEN", symbol);
      MarkHandled(ackId);
      return;
   }

   string symbolMessage = "";
   if(!EnsureSymbol(symbol, symbolMessage))
   {
      SendAck(ackId, "error", symbolMessage, 0, 0, side, "OPEN", symbol);
      MarkHandled(ackId);
      return;
   }

   string orderType = NormalizeOrderType(JsonGetString(body, "orderType"));
   if(orderType == "STOP_LIMIT" || orderType == "MARKET_RANGE")
   {
      SendAck(ackId, "error", "unsupported_order_type_for_mt5_ea=" + orderType,
              0, 0, side, "OPEN", symbol, orderType);
      MarkHandled(ackId);
      return;
   }
   if(orderType != "MARKET" && orderType != "LIMIT" && orderType != "STOP")
   {
      SendAck(ackId, "error", "unknown_order_type=" + orderType,
              0, 0, side, "OPEN", symbol, orderType);
      MarkHandled(ackId);
      return;
   }

   double lots = NormalizeVolume(symbol, JsonGetNumber(body, "qty", DefaultLots));
   double signalPrice = JsonGetNumber(body, "price", 0.0);
   double limitPrice = JsonGetNumber(body, "limitPrice", 0.0);
   double stopPrice = JsonGetNumber(body, "stopPrice", 0.0);
   double basisPrice = ResolveTradePrice(symbol, isBuy, orderType, signalPrice, limitPrice, stopPrice);

   if(orderType != "MARKET" && basisPrice <= 0.0)
   {
      SendAck(ackId, "error", "pending_order_price_required",
              0, 0, side, "OPEN", symbol, orderType);
      MarkHandled(ackId);
      return;
   }

   double sl = 0.0;
   double tp = 0.0;
   ResolveStops(symbol, isBuy, basisPrice,
                JsonGetNumber(body, "stopLoss", 0.0),
                JsonGetNumber(body, "takeProfit", 0.0),
                JsonGetNumber(body, "stopLossDistance", 0.0),
                JsonGetNumber(body, "takeProfitDistance", 0.0),
                sl, tp);

   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(MaxDeviationPoints);
   trade.SetTypeFillingBySymbol(symbol);

   string comment = "TradeBro ackId=" + IntegerToString(ackId);
   bool ok = false;

   if(orderType == "MARKET")
   {
      if(isBuy)
         ok = trade.Buy(lots, symbol, 0.0, sl, tp, comment);
      else
         ok = trade.Sell(lots, symbol, 0.0, sl, tp, comment);
   }
   else if(orderType == "LIMIT")
   {
      if(isBuy)
         ok = trade.BuyLimit(lots, basisPrice, symbol, sl, tp, ORDER_TIME_GTC, 0, comment);
      else
         ok = trade.SellLimit(lots, basisPrice, symbol, sl, tp, ORDER_TIME_GTC, 0, comment);
   }
   else if(orderType == "STOP")
   {
      if(isBuy)
         ok = trade.BuyStop(lots, basisPrice, symbol, sl, tp, ORDER_TIME_GTC, 0, comment);
      else
         ok = trade.SellStop(lots, basisPrice, symbol, sl, tp, ORDER_TIME_GTC, 0, comment);
   }

   int retcode = trade.ResultRetcode();
   ulong orderId = trade.ResultOrder();
   ulong dealId = trade.ResultDeal();
   ulong positionTicket = 0;
   if(orderType == "MARKET" && ok && IsTradeSuccessRetcode(retcode))
      FindLatestPositionTicket(symbol, isBuy, orderId, positionTicket);

   if(!ok || !IsTradeSuccessRetcode(retcode))
   {
      SendAck(ackId, "error",
              "Trade FAILED retcode=" + IntegerToString(retcode) +
              " desc=" + trade.ResultRetcodeDescription(),
              orderId, retcode, side, "OPEN", symbol, orderType, orderId, orderId, positionTicket, dealId);
      MarkHandled(ackId);
      return;
   }

   ulong primaryTicket = positionTicket > 0 ? positionTicket : orderId;
   SendAck(ackId, "success", "Trade SUCCESS ticket=" + IntegerToString((long)primaryTicket),
           primaryTicket, retcode, side, "OPEN", symbol, orderType, orderId, orderId, positionTicket, dealId);
   MarkHandled(ackId);
}

// ------------------------------------------------------------------
// Polling
// ------------------------------------------------------------------
void CheckApiAndTrade()
{
   string body;
   if(!HttpGet(SignalPollUrl(), body))
      return;

   if(StringLen(body) == 0 || body == "{}")
      return;

   Print("API response: ", body);

   long ackId = JsonGetLong(body, "ackId", -1);
   if(ackId < 0)
   {
      Print("No ackId in response; ignoring.");
      return;
   }

   if(ackId <= g_lastAckId)
   {
      Print("Signal ackId=", ackId, " already handled last=", g_lastAckId);
      return;
   }

   string control = JsonGetString(body, "control");
   StringToLower(control);
   if(control != "")
   {
      if(control == "pause")
      {
         g_paused = true;
         SendAck(ackId, "ok", "EA PAUSED by server control.", 0, 0, "", "CONTROL");
         MarkHandled(ackId);
         return;
      }
      if(control == "resume")
      {
         g_paused = false;
         SendAck(ackId, "ok", "EA RESUMED by server control.", 0, 0, "", "CONTROL");
         MarkHandled(ackId);
         return;
      }

      SendAck(ackId, "error", "Unknown control=" + control, 0, 0, "", "CONTROL");
      MarkHandled(ackId);
      return;
   }

   string side = JsonGetString(body, "side");
   StringToLower(side);
   string executionMode = JsonGetString(body, "executionMode");
   StringToUpper(executionMode);

   if(!MasterEnable || g_paused)
   {
      string why = !MasterEnable ? "MasterEnable=false" : "EA paused by server control";
      SendAck(ackId, "skipped", why, 0, 0, side, executionMode);
      MarkHandled(ackId);
      return;
   }

   if(side == "close" || side == "exit" || executionMode == "CLOSE")
   {
      ExecuteCloseSignal(ackId, body);
      return;
   }

   ExecuteOpenSignal(ackId, body);
}

int OnInit()
{
   int actualPoll = PollSeconds;
   if(actualPoll < 1) actualPoll = 1;

   if(StringLen(UserId) > 0)
      g_userId = UserId;
   else
      g_userId = IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN));

   // Build URLs from configurable BaseUrl
   string base = BaseUrl;
   // strip trailing slash
   while(StringLen(base) > 0 && StringGetCharacter(base, StringLen(base) - 1) == '/')
      base = StringSubstr(base, 0, StringLen(base) - 1);
   g_signalUrl = base + "/signal";
   g_ackUrl    = base + "/signal/ack";
   g_stateUrl  = base + "/signal/state";

   if(StringLen(PollKey) == 0)
      Print("WARNING: PollKey is empty. Requests will be rejected by the server. Set PollKey in EA inputs.");

   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(MaxDeviationPoints);
   LoadLastAck();

   Print("SignalPollerEA v3 init userId=", g_userId,
         " pollSeconds=", actualPoll,
         " magic=", MagicNumber,
         " lastAckId=", g_lastAckId,
         " baseUrl=", base,
         " pollKeySet=", StringLen(PollKey) > 0 ? "YES" : "NO");

   EventSetTimer(actualPoll);
   g_lastSyncTime = 0;
   SyncState();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   CheckApiAndTrade();
   SyncState();
}

//+------------------------------------------------------------------+
