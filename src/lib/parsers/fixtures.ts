/**
 * Fixtures mirroring the real exports, including their awkward parts: MT4's
 * colspan'd balance rows and lowercase symbols, MT5's duplicated Time/Price
 * headers, non-breaking-space thousands separators, and a still-open position
 * mixed in with closed ones.
 */

export const MT4_STATEMENT = `<html>
<head><title>Statement: 5012345</title></head>
<body>
<table>
<tr><td colspan="14"><b>Account: 5012345</b> Currency: USD</td></tr>
<tr align="center" bgcolor="#C0C0C0">
  <td>Ticket</td><td>Open Time</td><td>Type</td><td>Size</td><td>Item</td>
  <td>Price</td><td>S / L</td><td>T / P</td><td>Close Time</td><td>Price</td>
  <td>Commission</td><td>Taxes</td><td>Swap</td><td>Profit</td>
</tr>
<tr><td>100001</td><td>2024.03.01 08:00:00</td><td>balance</td><td colspan="10">Deposit</td><td>5&nbsp;000.00</td></tr>
<tr>
  <td>100002</td><td>2024.03.04 09:15:00</td><td>buy</td><td>0.50</td><td>eurusd</td>
  <td>1.08420</td><td>1.08000</td><td>1.09000</td><td>2024.03.04 13:45:00</td><td>1.08810</td>
  <td>-4.00</td><td>0.00</td><td>-1.20</td><td>195.00</td>
</tr>
<tr>
  <td>100003</td><td>2024.03.05 14:30:00</td><td>sell</td><td>1.00</td><td>xauusd</td>
  <td>2085.40</td><td>2095.00</td><td>2070.00</td><td>2024.03.06 10:05:00</td><td>2091.10</td>
  <td>-8.00</td><td>0.00</td><td>-3.50</td><td>-570.00</td>
</tr>
<tr>
  <td>100004</td><td>2024.03.07 02:10:00</td><td>buy</td><td>0.20</td><td>usdjpy</td>
  <td>149.820</td><td>0.000</td><td>0.000</td><td>2024.03.07 06:20:00</td><td>150.120</td>
  <td>-1.60</td><td>0.00</td><td>0.00</td><td>1&nbsp;240.50</td>
</tr>
<tr>
  <td>100005</td><td>2024.03.08 11:00:00</td><td>buy</td><td>0.30</td><td>eurusd</td>
  <td>1.09150</td><td>0.00000</td><td>0.00000</td><td></td><td></td>
  <td>0.00</td><td>0.00</td><td>0.00</td><td>12.00</td>
</tr>
</table>
</body></html>`;

export const MT5_REPORT = `<html>
<head><title>Trade History Report</title></head>
<body>
<div>MetaTrader 5</div>
<table>
<tr><th colspan="13">Positions</th></tr>
<tr>
  <th>Time</th><th>Position</th><th>Symbol</th><th>Type</th><th>Volume</th>
  <th>Price</th><th>S / L</th><th>T / P</th><th>Time</th><th>Price</th>
  <th>Commission</th><th>Swap</th><th>Profit</th>
</tr>
<tr>
  <td>2024.05.02 07:30:00</td><td>7001</td><td>GBPUSD</td><td>buy</td><td>0.40</td>
  <td>1.25630</td><td>1.25000</td><td>1.26500</td><td>2024.05.02 15:10:00</td><td>1.26010</td>
  <td>-3.20</td><td>-0.80</td><td>152.00</td>
</tr>
<tr>
  <td>2024.05.03 12:00:00</td><td>7002</td><td>US30</td><td>sell</td><td>1.00</td>
  <td>38450.0</td><td>38700.0</td><td>38100.0</td><td>2024.05.03 19:40:00</td><td>38520.0</td>
  <td>-5.00</td><td>0.00</td><td>-70.00</td>
</tr>
<tr>
  <td>2024.05.06 22:15:00</td><td>7003</td><td>BTCUSD</td><td>buy</td><td>0.10</td>
  <td>63200.00</td><td>0.00</td><td>0.00</td><td>2024.05.07 09:05:00</td><td>64150.00</td>
  <td>-2.50</td><td>-1.10</td><td>95.00</td>
</tr>
</table>
</body></html>`;

export const TRADINGVIEW_CSV = `Trade #,Type,Signal,Date/Time,Price USDT,Contracts,Profit USDT,Profit %,Cum. Profit USDT,Cum. Profit %
1,Entry long,Long,2024-01-03 09:00:00,42150.5,0.100,,,,
1,Exit long,Close,2024-01-03 17:30:00,42980.0,0.100,82.95,1.97,82.95,1.97
2,Entry short,Short,2024-01-05 11:00:00,43500.0,0.100,,,,
2,Exit short,Close,2024-01-06 08:15:00,43910.5,0.100,-41.05,-0.94,41.90,1.03
3,Entry long,Long,2024-01-08 14:45:00,42800.0,0.150,,,,
3,Exit long,Close,2024-01-09 22:10:00,43610.0,0.150,121.50,1.89,163.40,2.92`;

export const GENERIC_CSV = `Symbol,Side,Entry Time,Exit Time,Entry Price,Exit Price,Quantity,Net Profit,Commission
EURUSD,Buy,2024-02-01 10:00:00,2024-02-01 14:00:00,1.0820,1.0855,10000,35.00,-1.50
GBPJPY,Sell,2024-02-02 08:30:00,2024-02-02 11:45:00,188.50,188.10,5000,20.00,-0.75
XAUUSD,Buy,2024-02-05 15:00:00,2024-02-06 09:30:00,2040.5,2028.0,100,-125.00,-2.00`;
