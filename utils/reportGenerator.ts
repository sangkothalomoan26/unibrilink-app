
import type { Provider, Voucher } from '../types';
import { formatCurrency } from './helpers';

const formatRp = (amount: number) => formatCurrency(amount).replace('Rp', 'Rp ');

export const generateCompleteReport = (providers: Provider[], vouchers: Voucher[]): string => {
  let report = 'LAPORAN LENGKAP VOUCHER INTERNET UNI BRILINK\n\n';
  let grandTotalSales = 0;
  let grandTotalProfit = 0;

  providers.forEach(provider => {
    const providerVouchers = vouchers.filter(v => v.providerId === provider.id);
    if (providerVouchers.length === 0) return;

    report += `===== ${provider.name.toUpperCase()} =====\n\n`;
    let subTotalSales = 0;
    let subTotalProfit = 0;

    providerVouchers.forEach(v => {
      const sold = v.totalStock - v.remainingStock;
      const totalSales = sold * v.sellPrice;
      const totalCostOfSold = sold * v.costPrice;
      const profit = totalSales - totalCostOfSold;

      subTotalSales += totalSales;
      subTotalProfit += profit;

      report += `- ${v.name}\n`;
      report += `=================\n`;
      report += `Harga Modal : ${formatRp(v.costPrice)}\n`;
      report += `Harga Jual  : ${formatRp(v.sellPrice)}\n`;
      report += `--- Rincian Stok ---\n`;
      report += `Total Stok  : ${v.totalStock} pcs\n`;
      report += `Terjual     : ${sold} pcs\n`;
      report += `Sisa        : ${v.remainingStock} pcs\n`;
      report += `--- Rincian Keuangan ---\n`;
      report += `Total Penjualan       : ${formatRp(totalSales)}\n`;
      report += `Total Modal (Terjual) : ${formatRp(totalCostOfSold)}\n`;
      report += `Keuntungan            : ${formatRp(profit)}\n\n`;
    });
    
    grandTotalSales += subTotalSales;
    grandTotalProfit += subTotalProfit;

    report += `--- Sub-Total ${provider.name} ---\n`;
    report += `Total Penjualan : ${formatRp(subTotalSales)}\n`;
    report += `Total Keuntungan: ${formatRp(subTotalProfit)}\n`;
    report += `------------------------\n\n`;
  });

  report += `===== TOTAL KESELURUHAN =====\n`;
  report += `Total Seluruh Penjualan : ${formatRp(grandTotalSales)}\n`;
  report += `Total Seluruh Keuntungan: ${formatRp(grandTotalProfit)}\n\n`;
  report += `Created by : Sangkot Halomoan`;

  return report;
};

export const generateShortReport = (providers: Provider[], vouchers: Voucher[]): string => {
  let report = 'LAPORAN SISA & RENCANA TAMBAH STOK VOUCHER\n\n';
  let grandTotalPlannedCost = 0;

  providers.forEach(provider => {
    const providerVouchers = vouchers.filter(v => v.providerId === provider.id);
    if (providerVouchers.length === 0) return;

    report += `===== ${provider.name.toUpperCase()} =====\n\n`;
    let subTotalPlannedCost = 0;

    providerVouchers.forEach(v => {
      report += `- ${v.name}\n`;
      report += `Sisa Stok : ${v.remainingStock} pcs\n`;
      if (v.plannedStock > 0) {
        const estimatedCost = v.plannedStock * v.costPrice;
        subTotalPlannedCost += estimatedCost;
        report += `*Rencana Tambah Stok : ${v.plannedStock} Pcs x ${formatRp(v.costPrice)} = ${formatRp(estimatedCost)}*\n`;
      }
      report += `\n`;
    });
    
    grandTotalPlannedCost += subTotalPlannedCost;
    
    report += `--- *Sub-Total Modal ${provider.name}* ---\n`;
    report += `Total Rencana Tambah Stok    : ${formatRp(subTotalPlannedCost)}\n`;
    report += `---------------------------\n\n`;
  });

  report += ` *••TOTAL KESELURUHAN MODAL••*\n`;
  report += `Total Harga Tambah Stok    : ${formatRp(grandTotalPlannedCost)}\n\n`;
  report += `Dilaporkan Oleh : Sangkot Halomoan`;

  return report;
};

const getReceiptCSS = () => `
  @media print {
    @page {
      margin: 0;
      size: 58mm auto;
    }
  }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    color: #000;
    background-color: #fff;
    width: 58mm;
    margin: 0;
    padding: 5px;
    box-sizing: border-box;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 5px 0; }
  .header, .footer { margin-bottom: 5px; }
  .provider-name { text-transform: uppercase; font-weight: bold; margin-top: 8px; margin-bottom: 3px; }
  .voucher { margin-bottom: 5px; padding-left: 4px; }
  .totals { margin-top: 8px; }
  .footer { margin-top: 10px; }
  .right { text-align: right; }
  table { width: 100%; font-size: 9px; }
  td { vertical-align: top; }
  td:last-child { text-align: right; }
`;

const createReceiptHTML = (title: string, bodyContent: string, footer: string) => `
  <!DOCTYPE html>
  <html lang="id">
  <head>
    <meta charset="UTF-8">
    <title>Resi Laporan</title>
    <style>${getReceiptCSS()}</style>
  </head>
  <body>
    <div class="header center">
      <div class="bold">VOUCHER UNI BRILINK</div>
      <div>${new Date().toLocaleString('id-ID')}</div>
    </div>
    <div class="line"></div>
    <div class="center bold">${title}</div>
    ${bodyContent}
    <div class="line"></div>
    <div class="footer center">
      ${footer}<br><br>
      .
    </div>
  </body>
  </html>
`;

export const generateCompleteReceiptHTML = (providers: Provider[], vouchers: Voucher[]): string => {
  let bodyContent = '';
  let grandTotalSales = 0;
  let grandTotalProfit = 0;

  providers.forEach(provider => {
    const providerVouchers = vouchers.filter(v => v.providerId === provider.id);
    if (providerVouchers.length === 0) return;

    bodyContent += `<div class="provider-name">${provider.name}</div>`;
    let subTotalSales = 0;
    let subTotalProfit = 0;

    providerVouchers.forEach(v => {
      const sold = v.totalStock - v.remainingStock;
      const totalSales = sold * v.sellPrice;
      const profit = totalSales - (sold * v.costPrice);
      subTotalSales += totalSales;
      subTotalProfit += profit;
      
      bodyContent += `<div class="voucher">
                        <div><b>${v.name}</b></div>
                        <table>
                           <tr><td>Sisa/Total Stok</td><td>${v.remainingStock}/${v.totalStock}</td></tr>
                           <tr><td>Terjual</td><td>${sold} pcs</td></tr>
                           <tr><td>Total Penjualan</td><td>${formatRp(totalSales)}</td></tr>
                           <tr><td>Keuntungan</td><td>${formatRp(profit)}</td></tr>
                        </table>
                      </div>`;
    });
    
    grandTotalSales += subTotalSales;
    grandTotalProfit += subTotalProfit;
    
    bodyContent += `<div>Sub-Total Penjualan: ${formatRp(subTotalSales)}</div>`;
    bodyContent += `<div>Sub-Total Keuntungan: ${formatRp(subTotalProfit)}</div>`;
  });

  bodyContent += `<div class="totals">
                    <div class="line"></div>
                    <div><b>Total Penjualan : ${formatRp(grandTotalSales)}</b></div>
                    <div><b>Total Keuntungan: ${formatRp(grandTotalProfit)}</b></div>
                  </div>`;
  
  return createReceiptHTML('LAPORAN LENGKAP', bodyContent, 'Created by : Sangkot Halomoan');
};

export const generateShortReceiptHTML = (providers: Provider[], vouchers: Voucher[]): string => {
  let bodyContent = '';
  let grandTotalPlannedCost = 0;

  providers.forEach(provider => {
    const providerVouchers = vouchers.filter(v => v.providerId === provider.id);
    if (providerVouchers.length === 0) return;

    bodyContent += `<div class="provider-name">${provider.name}</div>`;
    let subTotalPlannedCost = 0;

    providerVouchers.forEach(v => {
      bodyContent += `<div class="voucher">
                        <div><b>- ${v.name}</b></div>
                        <div>Sisa Stok : ${v.remainingStock} pcs</div>`;
      if (v.plannedStock > 0) {
        const estimatedCost = v.plannedStock * v.costPrice;
        subTotalPlannedCost += estimatedCost;
        bodyContent += `<div>Rencana   : ${v.plannedStock} pcs (${formatRp(estimatedCost)})</div>`;
      }
      bodyContent += `</div>`;
    });
    
    grandTotalPlannedCost += subTotalPlannedCost;
    bodyContent += `<div>Sub-Total Modal: ${formatRp(subTotalPlannedCost)}</div>`;
  });

  bodyContent += `<div class="totals">
                    <div class="line"></div>
                    <div><b>Total Tambah Modal: ${formatRp(grandTotalPlannedCost)}</b></div>
                  </div>`;
  
  return createReceiptHTML('LAPORAN SINGKAT', bodyContent, 'Dilaporkan Oleh : Sangkot Halomoan');
};
