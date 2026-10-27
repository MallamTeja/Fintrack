import { describe, expect, it } from 'vitest';
import { parseMoney, readDirection } from '../lib/statement/amounts.js';
import { categorise, cleanDescription, paymentMethodFrom } from '../lib/statement/categorise.js';
import { guessDayFirst, parseStatementDate } from '../lib/statement/dates.js';
import { analyseLines, analyseRows, csvToRows, draftTotals, editDraft, groupLines, markDuplicates, toImportRow } from '../lib/statement/index.js';
import { detectHeader, roleOfHeader } from '../lib/statement/table.js';
import { parseUpiText } from '../lib/statement/upi.js';
import { tsvToItems } from '../lib/statement/ocr.js';
import { brandName, joinWrappedName, payeeKeyFrom, upiIdFrom } from '../lib/statement/payee.js';

const HDFC = `"HDFC BANK Ltd.","Page No .: 1"
"Statement of accounts"
Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/10/25,UPI-SWIGGY-SWIGGY@ICICI-ICIC0DC0099-412345678901-PAYMENT,0000412345678901,01/10/25,450.00,,"1,04,550.00"
02/10/25,NEFT CR-HDFC0000001-ACME TECHNOLOGIES PVT LTD-SALARY OCT,N123456789,02/10/25,,"85,000.00","1,89,550.00"
03/10/25,POS 416021XXXXXX1234 AMAZON PAY INDIA,000000000000,03/10/25,"1,299.00",,"1,88,251.00"
,ONLINE ORDER 4412,,,,,
,,,,,,
"STATEMENT SUMMARY :-"
Opening Balance,Dr Count,Cr Count,Debits,Credits,Closing Bal
"1,05,000.00",2,1,"1,749.00","85,000.00","1,88,251.00"
`;

const SBI = `Account Name :,MS. MAYA OKONKWO
Account Number :,00000012345678
Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
1 Oct 2025,1 Oct 2025,TO TRANSFER-UPI/DR/412345678901/RAPIDO/YESB/rapido@ybl/UPI--,TRANSFER TO 4897691162091,120.00,,"10,380.00"
2 Oct 2025,2 Oct 2025,BY TRANSFER-NEFT*HDFC0000001*N12345*ACME TECH PVT LTD--,TRANSFER FROM 1234,,"50,000.00","60,380.00"
5 Oct 2025,5 Oct 2025,ATM WDL-ATM CASH 1234 MG ROAD BANGALORE,,"2,000.00",,"58,380.00"
,,Closing balance,,,,"58,380.00"
**This is a computer generated statement**`;

const ICICI = `S No.,Value Date,Transaction Date,Cheque Number,Transaction Remarks,Withdrawal Amount (INR ),Deposit Amount (INR ),Balance (INR )
1,01/10/2025,01/10/2025,-,UPI/412345678901/NETFLIX/netflix@icici/Payment/ICIC0000001,649.00,0.00,"25,351.00"
2,03/10/2025,03/10/2025,-,MMT/IMPS/412345678901/RAMESH KUMAR/SBIN0001234,"5,000.00",0.00,"20,351.00"
3,15/10/2025,15/10/2025,-,BESCOM BILL PAYMENT,"1,840.50",0.00,"18,510.50"
4,31/13/2025,31/13/2025,-,BROKEN DATE ROW,10.00,0.00,"18,500.50"`;

const KOTAK = `Sl. No.;Transaction Date;Value Date;Description;Chq / Ref No.;Amount;Dr / Cr;Balance;Dr / Cr
1;05-10-2025;05-10-2025;UPI/ZOMATO/412345678901/Payment;UPI-412345678901;350.00;DR;9,650.00;CR
2;06-10-2025;06-10-2025;Int.Pd:01-07-2025 to 30-09-2025;;123.45;CR;9,773.45;CR`;

const SIGNED = `Date,Description,Amount
2025-10-01,Spotify India,-119
2025-10-02,Refund from Myntra,"₹1,499.00"
2025-10-02,Refund from Myntra,"₹1,499.00"`;

describe('statement dates', () => {
  it('reads Indian day-first dates in every common shape', () => {
    expect(parseStatementDate('05/10/2025')).toBe('2025-10-05');
    expect(parseStatementDate('05-10-25')).toBe('2025-10-05');
    expect(parseStatementDate('05.10.2025')).toBe('2025-10-05');
    expect(parseStatementDate('5 Oct 2025')).toBe('2025-10-05');
    expect(parseStatementDate('05-Oct-25')).toBe('2025-10-05');
    expect(parseStatementDate('Oct 05, 2025 10:23 am')).toBe('2025-10-05');
    expect(parseStatementDate('01 Oct, 2025')).toBe('2025-10-01');
    expect(parseStatementDate('2025-10-05')).toBe('2025-10-05');
    expect(parseStatementDate('05/10/2025 14:02:11')).toBe('2025-10-05');
  });

  it('handles month-first data, Excel serials, Date objects and rejects impossible days', () => {
    expect(parseStatementDate('10/25/2025', { dayFirst: false })).toBe('2025-10-25');
    expect(parseStatementDate('25/10/2025', { dayFirst: false })).toBe('2025-10-25');
    expect(guessDayFirst(['10/25/2025', '10/26/2025'])).toBe(false);
    expect(guessDayFirst(['25/10/2025', '01/10/2025'])).toBe(true);
    expect(parseStatementDate(45935)).toBe('2025-10-05');
    expect(parseStatementDate(new Date(Date.UTC(2025, 9, 5)))).toBe('2025-10-05');
    expect(parseStatementDate('31/02/2025')).toBe('');
    expect(parseStatementDate('Opening balance')).toBe('');
  });
});

describe('statement amounts', () => {
  it('reads commas, rupee marks, Dr/Cr and negative notation', () => {
    expect(parseMoney('₹1,23,456.50')).toEqual({ value: 123456.5, negative: false, marker: '' });
    expect(parseMoney('Rs. 500')).toMatchObject({ value: 500 });
    expect(parseMoney('INR 250.00')).toMatchObject({ value: 250 });
    expect(parseMoney('1,234.50 Dr')).toEqual({ value: 1234.5, negative: false, marker: 'dr' });
    expect(parseMoney('980.00 CR')).toMatchObject({ value: 980, marker: 'cr' });
    expect(parseMoney('(500.00)')).toMatchObject({ value: 500, negative: true });
    expect(parseMoney('-119')).toMatchObject({ value: 119, negative: true });
    expect(parseMoney('750-')).toMatchObject({ value: 750, negative: true });
    expect(parseMoney('-')).toBeNull();
    expect(parseMoney('UPI-4123')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });

  it('reads direction markers', () => {
    expect(readDirection('DR')).toBe('dr');
    expect(readDirection('Cr.')).toBe('cr');
    expect(readDirection('Withdrawal')).toBe('dr');
    expect(readDirection('Deposit')).toBe('cr');
    expect(readDirection('balance')).toBe('');
  });
});

describe('categorise and describe', () => {
  it('maps merchants to categories', () => {
    expect(categorise('UPI-SWIGGY-SWIGGY@ICICI')).toBe('Food');
    expect(categorise('ZOMATO ORDER')).toBe('Food');
    expect(categorise('UBER INDIA TRIP')).toBe('Transport');
    expect(categorise('IRCTC E-TICKET')).toBe('Transport');
    expect(categorise('AMAZON PAY INDIA')).toBe('Shopping');
    expect(categorise('NETFLIX.COM')).toBe('Subscriptions');
    expect(categorise('Amazon Prime membership')).toBe('Subscriptions');
    expect(categorise('BESCOM BILL PAYMENT')).toBe('Utilities');
    expect(categorise('Airtel postpaid')).toBe('Utilities');
    expect(categorise('HOUSE RENT OCT')).toBe('Rent');
    expect(categorise('APOLLO PHARMACY')).toBe('Health');
    expect(categorise('NEFT CR-ACME TECHNOLOGIES PVT LTD', 'income')).toBe('Salary');
    expect(categorise('SALARY FOR OCT', 'income')).toBe('Salary');
    expect(categorise('Int.Pd:01-07-2025 to 30-09-2025', 'income')).toBe('Interest');
    expect(categorise('REFUND FROM FLIPKART', 'income')).toBe('Refund');
    expect(categorise('Something unusual')).toBe('Other');
    expect(categorise('Something unusual', 'income')).toBe('Other income');
  });

  it('reads the payment method from the narration', () => {
    expect(paymentMethodFrom('UPI/412345/SWIGGY')).toBe('upi');
    expect(paymentMethodFrom('MMT/IMPS/4123/RAMESH')).toBe('bank');
    expect(paymentMethodFrom('NEFT CR-ACME')).toBe('bank');
    expect(paymentMethodFrom('ATM WDL-ATM CASH 1234')).toBe('cash');
    expect(paymentMethodFrom('POS 416021XXXXXX1234 AMAZON')).toBe('card');
    expect(paymentMethodFrom('Paytm wallet top up')).toBe('wallet');
    expect(paymentMethodFrom('CHEQUE DEPOSIT 001')).toBe('bank');
    expect(paymentMethodFrom('Lunch')).toBe('other');
  });

  it('pulls the payee out of packed UPI and bank narrations', () => {
    expect(cleanDescription('UPI-SWIGGY-SWIGGY@ICICI-ICIC0DC0099-412345678901-PAYMENT')).toBe('Swiggy');
    expect(cleanDescription('TO TRANSFER-UPI/DR/412345678901/RAPIDO/YESB/rapido@ybl/UPI--')).toBe('Rapido');
    expect(cleanDescription('UPI/P2M/412345678901/ZOMATO LTD/UPI/YES BANK')).toBe('Zomato');
    expect(cleanDescription('MMT/IMPS/412345678901/RAMESH KUMAR/SBIN0001234')).toBe('Ramesh Kumar');
    expect(cleanDescription('NEFT-HDFCN52025101512345-ACME TECHNOLOGIES PVT LTD-0001')).toBe('Acme Technologies Pvt Ltd');
    expect(cleanDescription('BESCOM   BILL PAYMENT')).toBe('BESCOM BILL PAYMENT');
    expect(cleanDescription('ATM WDL-ATM CASH 1234')).toBe('ATM cash withdrawal');
  });
});

describe('bank tables', () => {
  it('finds header roles', () => {
    expect(roleOfHeader('Withdrawal Amt.')).toBe('debit');
    expect(roleOfHeader('Deposit Amount (INR )')).toBe('credit');
    expect(roleOfHeader('Closing Balance')).toBe('balance');
    expect(roleOfHeader('Chq./Ref.No.')).toBe('reference');
    expect(roleOfHeader('Value Dt')).toBe('date');
    expect(roleOfHeader('Dr / Cr')).toBe('direction');
    expect(roleOfHeader('Transaction Remarks')).toBe('description');
    expect(roleOfHeader('Amount')).toBe('amount');
  });

  it('reads an HDFC export, joining wrapped narration and skipping the summary', () => {
    const a = analyseRows(csvToRows(HDFC));
    expect(a.confidence).toBe('high');
    expect(a.headerRow).toBe(2);
    expect(a.drafts).toHaveLength(3);
    const [swiggy, salary, amazon] = a.drafts;
    expect(swiggy).toMatchObject({ date: '2025-10-01', amount: 450, type: 'expense', description: 'Swiggy', category: 'Food', payment_method: 'upi', include: true });
    expect(salary).toMatchObject({ date: '2025-10-02', amount: 85000, type: 'income', category: 'Salary', payment_method: 'bank' });
    expect(amazon).toMatchObject({ amount: 1299, type: 'expense', category: 'Shopping', payment_method: 'card' });
    expect(amazon.raw).toBe('POS 416021XXXXXX1234 AMAZON PAY INDIA ONLINE ORDER 4412');
    expect(a.skipped).toBeGreaterThan(0);
  });

  it('reads an SBI export with account lines above the header and a closing balance row', () => {
    const a = analyseRows(csvToRows(SBI));
    expect(a.confidence).toBe('high');
    expect(a.drafts.map((d) => [d.date, d.amount, d.type, d.description])).toEqual([
      ['2025-10-01', 120, 'expense', 'Rapido'],
      ['2025-10-02', 50000, 'income', 'Acme Tech Pvt Ltd'],
      ['2025-10-05', 2000, 'expense', 'ATM cash withdrawal'],
    ]);
    expect(a.drafts[0].category).toBe('Transport');
    expect(a.drafts[2]).toMatchObject({ category: 'Cash', payment_method: 'cash' });
  });

  it('reads an ICICI export, prefers the transaction date and flags a bad row', () => {
    const a = analyseRows(csvToRows(ICICI));
    expect(a.mapping.date).toBe(2);
    expect(a.drafts).toHaveLength(4);
    expect(a.drafts[0]).toMatchObject({ description: 'Netflix', category: 'Subscriptions', amount: 649 });
    expect(a.drafts[1]).toMatchObject({ description: 'Ramesh Kumar', payment_method: 'bank' });
    expect(a.drafts[2]).toMatchObject({ amount: 1840.5, category: 'Utilities' });
    expect(a.drafts[3].include).toBe(false);
    expect(a.drafts[3].errors.date).toMatch(/Date not recognised/);
  });

  it('reads a single amount column with a Dr/Cr column (Kotak, semicolons)', () => {
    const a = analyseRows(csvToRows(KOTAK));
    expect(a.mapping).toMatchObject({ amount: 5, direction: 6, balance: 7 });
    expect(a.drafts.map((d) => [d.type, d.amount, d.category])).toEqual([
      ['expense', 350, 'Food'],
      ['income', 123.45, 'Interest'],
    ]);
  });

  it('reads signed amounts and marks repeats as possible duplicates', () => {
    const a = analyseRows(csvToRows(SIGNED));
    expect(a.drafts.map((d) => d.type)).toEqual(['expense', 'income', 'income']);
    const marked = markDuplicates(a.drafts, [{ date: '2025-10-01', type: 'expense', amount: 119 }]);
    expect(marked.map((d) => d.dup)).toEqual(['ledger', '', 'file']);
  });

  it('asks for a mapping when there is no header row', () => {
    const rows = csvToRows('05/10/2025,Tea stall,40.00\n06/10/2025,Book shop,350.00');
    const a = analyseRows(rows);
    expect(a.confidence).toBe('low');
    expect(a.mapping).toMatchObject({ date: 0, description: 1, amount: 2 });
    const remapped = analyseRows(rows, { mapping: { date: 0, description: 1, amount: 2 }, headerRow: -1 });
    expect(remapped.confidence).toBe('high');
    expect(remapped.drafts).toHaveLength(2);
  });

  it('totals included rows, re-validates edits and builds the API payload', () => {
    const a = analyseRows(csvToRows(HDFC));
    const t = draftTotals(a.drafts);
    expect(t).toEqual({ count: 3, income: 85000, expense: 1749, from: '2025-10-01', to: '2025-10-03' });
    const bad = editDraft(a.drafts[0], { category: 'Food <script>' });
    expect(bad.include).toBe(false);
    expect(bad.errors.category).toBeTruthy();
    const fixed = editDraft(bad, { category: 'Eating out' });
    expect(fixed.include).toBe(true);
    expect(toImportRow(fixed)).toEqual({
      date: '2025-10-01',
      description: 'Swiggy',
      amount: 450,
      type: 'expense',
      category: 'Eating out',
      payment_method: 'upi',
      notes: 'UPI-SWIGGY-SWIGGY@ICICI-ICIC0DC0099-412345678901-PAYMENT',
      payee_key: 'name:swiggy',
    });
  });
});

describe('UPI app statements and PDF layout', () => {
  const PHONEPE = [
    'Transaction Statement for 98XXXXXX10',
    'Date  Transaction Details  Type  Amount',
    'Oct 05, 2025  Paid to SWIGGY  DEBIT  ₹250',
    '10:23 am  Transaction ID T2510051023',
    'Debited from XXXXXXXX1234',
    'Oct 06, 2025  Received from Ramesh Kumar  CREDIT  ₹1,500',
    'Credited to XXXXXXXX1234',
    'Oct 07, 2025  Paid to Airtel Prepaid  DEBIT  ₹299',
  ];

  it('reads PhonePe style lines', () => {
    const { drafts } = parseUpiText(PHONEPE);
    expect(drafts.map((d) => [d.date, d.type, d.amount, d.description, d.category])).toEqual([
      ['2025-10-05', 'expense', 250, 'Paid to SWIGGY', 'Food'],
      ['2025-10-06', 'income', 1500, 'Received from Ramesh Kumar', 'Other income'],
      ['2025-10-07', 'expense', 299, 'Paid to Airtel Prepaid', 'Utilities'],
    ]);
    expect(drafts.every((d) => d.payment_method === 'upi')).toBe(true);
  });

  it('reads Google Pay and Paytm style lines with the date on the line above or amounts below', () => {
    const { drafts } = parseUpiText([
      '01 Oct, 2025',
      'Paid to Uber India  ₹312.50',
      'UPI Transaction ID: 412345678901',
      'Paid by HDFC Bank 1234',
      '02 Oct, 2025',
      'Received from Asha',
      'Credit INR 800.00',
      '03 Oct 2025 Paid to Apollo Pharmacy - Rs.420',
    ]);
    expect(drafts.map((d) => [d.date, d.type, d.amount, d.category])).toEqual([
      ['2025-10-01', 'expense', 312.5, 'Transport'],
      ['2025-10-02', 'income', 800, 'Other income'],
      ['2025-10-03', 'expense', 420, 'Health'],
    ]);
  });

  it('groups positioned PDF text into lines and cells', () => {
    const lines = groupLines([
      { str: 'Paid to', x: 100, y: 700, w: 30, h: 10, page: 1 },
      { str: 'Oct 05, 2025', x: 20, y: 700.6, w: 55, h: 10, page: 1 },
      { str: 'SWIGGY', x: 132, y: 700, w: 35, h: 10, page: 1 },
      { str: '₹250', x: 400, y: 699.5, w: 20, h: 10, page: 1 },
      { str: '10:23 am', x: 20, y: 688, w: 35, h: 10, page: 1 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0].cells.map((c) => c.text)).toEqual(['Oct 05, 2025', 'Paid to SWIGGY', '₹250']);
    const a = analyseLines(lines);
    expect(a.layout).toBe('upi');
    expect(a.drafts[0]).toMatchObject({ date: '2025-10-05', amount: 250, type: 'expense' });
  });

  it('rebuilds a bank PDF table by column position', () => {
    const item = (str, x, y, w = str.length * 5) => ({ str, x, y, w, h: 9, page: 1 });
    const lines = groupLines([
      item('Date', 20, 700), item('Narration', 80, 700), item('Withdrawal Amt.', 300, 700), item('Deposit Amt.', 380, 700), item('Closing Balance', 460, 700),
      item('01/10/25', 20, 680), item('UPI-ZOMATO-ZOMATO@HDFC-412345678901', 80, 680), item('350.00', 330, 680), item('9,650.00', 480, 680),
      item('02/10/25', 20, 668), item('INTEREST PAID', 80, 668), item('42.00', 400, 668), item('9,692.00', 480, 668),
    ]);
    const a = analyseLines(lines);
    expect(a.layout).toBe('table');
    expect(a.drafts.map((d) => [d.date, d.type, d.amount, d.category])).toEqual([
      ['2025-10-01', 'expense', 350, 'Food'],
      ['2025-10-02', 'income', 42, 'Interest'],
    ]);
  });

  it('detects headers for the column mapping', () => {
    expect(detectHeader([['foo', 'bar', 'baz']])).toBeNull();
  });
});

describe('vertically centred narration (Union Bank layout)', () => {
  // Each entry's narration has one line above the date line and one below, as in Union Bank PDFs.
  const item = (str, x, y) => ({ str, x, y, w: str.length * 4, h: 8, page: 1 });
  const entry = (y, sl, date, narr1, narr2, debit, credit, bal) => [
    item(narr1, 106, y + 5),
    item(String(sl), 32, y), item(date, 50, y), ...(debit ? [item(debit, 376, y)] : []), ...(credit ? [item(credit, 452, y)] : []), item(bal, 530, y),
    item(narr2, 106, y - 6),
  ];
  const items = [
    item('Sl', 30, 300), item('Date', 64, 300), item('Particulars', 151, 300), item('Withdrawal', 340, 300), item('Deposit', 427, 300), item('Balance', 514, 300),
    ...entry(270, 1, '05-09-2026', 'UPIAB/508250878620/CR/PULLAIA', 'H/SBIN/9866352390-2@ybl', '', '5,500.00', '9,732.35 Cr'),
    ...entry(248, 2, '07-09-2026', 'UPIAR/129191139507/DR/VENNAP', 'US/UBIN/vsr@okaxis', '250.00', '', '9,482.35 Cr'),
    ...entry(226, 3, '08-09-2026', 'UPIAR/169695810033/DR/SWIGGY', 'L/UTIB/swiggy@icici', '150.00', '', '9,332.35 Cr'),
  ];

  it('joins the line above the date line to its own entry', () => {
    const r = analyseLines(groupLines(items));
    expect(r.drafts).toHaveLength(3);
    expect(r.drafts[0]).toMatchObject({ date: '2026-09-05', type: 'income', amount: 5500, description: 'Pullaiah', payment_method: 'upi' });
    expect(r.drafts[1]).toMatchObject({ type: 'expense', amount: 250, description: 'Vennapus' });
    expect(r.drafts[2].notes).toContain('UPIAR/169695810033/DR/SWIGGY');
    expect(r.drafts[2].notes).toContain('swiggy@icici');
  });

  it('leaves downward-wrapped narration with the entry above', () => {
    const down = [
      item('Date', 50, 300), item('Narration', 106, 300), item('Withdrawal', 376, 300), item('Deposit', 452, 300), item('Balance', 530, 300),
      item('05-09-2026', 50, 280), item('UPI/1234/Grocer', 106, 280), item('120.00', 376, 280), item('900.00', 530, 280),
      item('Mart/okaxis', 106, 272),
      item('06-09-2026', 50, 260), item('NEFT/Salary', 106, 260), item('5,000.00', 452, 260), item('5,900.00', 530, 260),
      item('ACME LTD', 106, 252),
      item('07-09-2026', 50, 240), item('UPI/99/Tea', 106, 240), item('20.00', 376, 240), item('5,880.00', 530, 240),
    ];
    const r = analyseLines(groupLines(down));
    expect(r.drafts).toHaveLength(3);
    expect(r.drafts[0].notes || r.drafts[0].description).toContain('Mart');
    expect(r.drafts[1].notes || r.drafts[1].description).toContain('ACME');
  });
});

describe('tsvToItems', () => {
  it('reads word rows and flips y so a page reads top to bottom', () => {
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t250\t100\t50\t20\t95\tHello',
      '5\t1\t1\t1\t2\t1\t250\t200\t50\t20\t91\tWorld',
      '4\t1\t1\t1\t2\t0\t250\t200\t50\t20\t-1\t',
      '5\t1\t1\t1\t3\t1\t250\t300\t50\t20\t-1\t ',
    ].join('\n');
    const items = tsvToItems(tsv, 2, 2.5);
    expect(items).toEqual([
      { str: 'Hello', x: 100, y: -48, w: 20, h: 8, page: 2 },
      { str: 'World', x: 100, y: -88, w: 20, h: 8, page: 2 },
    ]);
    expect(items[0].y).toBeGreaterThan(items[1].y);
  });
});

describe('payee names and keys', () => {
  it('joins names a bank wrapped mid-word but keeps initials', () => {
    expect(joinWrappedName('PULLAIA H')).toBe('PULLAIAH');
    expect(joinWrappedName('VENNAP US')).toBe('VENNAPUS');
    expect(joinWrappedName('BALAJI C')).toBe('BALAJI C');
    expect(joinWrappedName('SRI SAI J')).toBe('SRI SAI J');
    expect(joinWrappedName('MARVEL H')).toBe('MARVEL H');
  });
  it('names known businesses', () => {
    expect(brandName('FLIPKART')).toBe('Flipkart');
    expect(brandName('Swiggy L')).toBe('Swiggy');
    expect(brandName('Shadow fa')).toBe('Shadowfax');
    expect(brandName('Ravi')).toBe('');
  });
  it('cleans Union Bank UPI narrations into full names', () => {
    expect(cleanDescription('UPIAB/508250878620/CR/PULLAIA H/SBIN/9866352390-2@ybl')).toBe('Pullaiah');
    expect(cleanDescription('UPIAB/613124582666/CR/Swiggy L/UTIB/swiggy.refunds')).toBe('Swiggy');
    expect(cleanDescription('UPIAR/663304210940/DR/RELIANC E/CITI/jio@citibank')).toBe('Reliance');
  });
  it('keys payees by UPI handle, by bank-code handle, or by brand', () => {
    expect(payeeKeyFrom('UPIAB/1/CR/PULLAIA H/SBIN/9866352390-2@ybl', 'Pullaiah')).toBe('upi:9866352390-2');
    expect(payeeKeyFrom('UPIAR/1/DR/BHUKYA /SBIN/manojbhukya072', 'Bhukya')).toBe('upi:manojbhukya072');
    expect(payeeKeyFrom('UPIAR/1/DR/ SWIGGY/ICIC/upiswiggy @icic', 'Swiggy')).toBe('name:swiggy');
    expect(payeeKeyFrom('NEFT ACME LTD', 'Acme Ltd')).toBe('name:acme ltd');
    expect(payeeKeyFrom('', '')).toBe('');
    expect(upiIdFrom('x/SBIN/9866352390-2@ybl')).toBe('9866352390-2@ybl');
  });
  it('sends payee_key with imported rows', () => {
    const [d] = analyseRows(csvToRows('Date,Narration,Withdrawal,Deposit\n05/09/2026,UPIAB/508250878620/CR/PULLAIA H/SBIN/9866352390-2@ybl,,5500')).drafts;
    expect(d.description).toBe('Pullaiah');
    expect(toImportRow(d).payee_key).toBe('upi:9866352390-2');
  });
});
