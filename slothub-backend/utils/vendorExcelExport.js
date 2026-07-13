const ExcelJS = require('exceljs');

const C = {
    brand: 'FFF27124',
    brandDark: 'FF1E293B',
    white: 'FFFFFFFF',
    subHeader: 'FFFFF7ED',
    altRow: 'FFF8FAFC',
    border: 'FFE2E8F0',
    green: 'FF16A34A',
    muted: 'FF64748B',
    blue: 'FF2563EB'
};

const fmtDate = (d = new Date()) =>
    d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

const safeFilePart = (str) =>
    String(str || 'Quan')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 40) || 'Quan';

const applyBorder = (cell) => {
    cell.border = {
        top: { style: 'thin', color: { argb: C.border } },
        left: { style: 'thin', color: { argb: C.border } },
        bottom: { style: 'thin', color: { argb: C.border } },
        right: { style: 'thin', color: { argb: C.border } }
    };
};

const styleBanner = (ws, row, colSpan, title, subtitle) => {
    ws.mergeCells(row, 1, row, colSpan);
    const titleCell = ws.getCell(row, 1);
    titleCell.value = title;
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: C.white } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.brand } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(row).height = 32;

    ws.mergeCells(row + 1, 1, row + 1, colSpan);
    const subCell = ws.getCell(row + 1, 1);
    subCell.value = subtitle;
    subCell.font = { name: 'Segoe UI', size: 10, color: { argb: C.muted } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.subHeader } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(row + 1).height = 22;
};

const styleSectionTitle = (ws, row, colSpan, text) => {
    ws.mergeCells(row, 1, row, colSpan);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: C.brandDark } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.subHeader } };
    cell.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(row).height = 24;
};

const styleHeaderRow = (row) => {
    row.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: C.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.brandDark } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        applyBorder(cell);
    });
    row.height = 26;
};

const styleDataRow = (row, index, { moneyCols = [], centerCols = [] } = {}) => {
    const isAlt = index % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 10, color: { argb: C.brandDark } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isAlt ? C.altRow : C.white }
        };
        if (moneyCols.includes(colNumber) && typeof cell.value === 'number') {
            cell.numFmt = '#,##0" đ"';
            cell.font = { ...cell.font, bold: true, color: { argb: C.brand } };
            cell.alignment = { horizontal: 'right' };
        }
        if (centerCols.includes(colNumber)) {
            cell.alignment = { horizontal: 'center' };
        }
        applyBorder(cell);
    });
    row.height = 20;
};

const setColWidths = (ws, widths) => {
    widths.forEach((w, i) => {
        ws.getColumn(i + 1).width = w;
    });
};

const addOverviewSheet = (wb, { vendor, overview }) => {
    const ws = wb.addWorksheet('Tổng quan', {
        views: [{ showGridLines: false }],
        properties: { defaultRowHeight: 20 }
    });

    const colSpan = 7;
    setColWidths(ws, [22, 14, 14, 14, 14, 14, 14]);

    styleBanner(
        ws,
        1,
        colSpan,
        'SLOTHUB · BÁO CÁO THỐNG KÊ QUẦY',
        `${vendor.name}  ·  Xuất lúc ${fmtDate()}`
    );

    styleSectionTitle(ws, 4, colSpan, 'CHỈ SỐ THEO KỲ (đơn đã thanh toán)');

    const headerRow = ws.getRow(5);
    headerRow.values = ['Chỉ số', 'Hôm nay', 'Tháng này', 'Tháng trước', 'Năm nay', 'Năm trước', 'Tất cả'];
    styleHeaderRow(headerRow);

    const periods = ['today', 'thisMonth', 'lastMonth', 'thisYear', 'lastYear', 'allTime'];
    const metrics = [
        { label: 'Số khách hàng', key: 'customers', money: false },
        { label: 'Lượt mua', key: 'orders', money: false },
        { label: 'Doanh thu', key: 'revenue', money: true },
        { label: 'Ví quầy (95%)', key: 'vendorShare', money: true }
    ];

    metrics.forEach((m, idx) => {
        const row = ws.getRow(6 + idx);
        row.values = [
            m.label,
            ...periods.map((p) => overview?.[p]?.[m.key] ?? 0)
        ];
        styleDataRow(row, idx, {
            moneyCols: m.money ? [2, 3, 4, 5, 6, 7] : [],
            centerCols: m.money ? [] : [2, 3, 4, 5, 6, 7]
        });
    });

    const cmp = overview?.comparisons;
    if (cmp) {
        styleSectionTitle(ws, 11, colSpan, 'SO SÁNH % THAY ĐỔI');
        const cmpHeader = ws.getRow(12);
        cmpHeader.values = ['Chỉ số', 'So tháng trước', 'So năm trước (doanh thu / lượt mua)', '', '', '', ''];
        styleHeaderRow(cmpHeader);

        const cmpRows = [
            ['Doanh thu', `${cmp.revenueMonthChange > 0 ? '+' : ''}${cmp.revenueMonthChange}%`, `${cmp.revenueYearChange > 0 ? '+' : ''}${cmp.revenueYearChange}%`],
            ['Lượt mua', `${cmp.ordersMonthChange > 0 ? '+' : ''}${cmp.ordersMonthChange}%`, `${cmp.ordersYearChange > 0 ? '+' : ''}${cmp.ordersYearChange}%`],
            ['Khách hàng', `${cmp.customersMonthChange > 0 ? '+' : ''}${cmp.customersMonthChange}%`, '—']
        ];
        cmpRows.forEach((vals, idx) => {
            const row = ws.getRow(13 + idx);
            row.values = [...vals, '', '', '', ''];
            styleDataRow(row, idx, { centerCols: [2, 3] });
        });
    }

    ws.mergeCells(16, 1, 16, colSpan);
    const foot = ws.getCell(16, 1);
    foot.value = 'SlotHub · FPT Canteen — Báo cáo tự động từ hệ thống đặt món';
    foot.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: C.muted } };
    foot.alignment = { horizontal: 'center' };
};

const addPeriodSheet = (wb, sheetName, bannerTitle, rows, columns) => {
    const ws = wb.addWorksheet(sheetName, {
        views: [{ showGridLines: false }],
        properties: { defaultRowHeight: 20 }
    });

    const colSpan = columns.length;
    setColWidths(ws, columns.map((c) => c.width));

    styleBanner(ws, 1, colSpan, bannerTitle, `Dữ liệu chi tiết  ·  ${fmtDate()}`);

    const headerRow = ws.getRow(4);
    headerRow.values = columns.map((c) => c.header);
    styleHeaderRow(headerRow);

    let totalRevenue = 0;
    let totalOrders = 0;
    let totalCustomers = 0;
    let totalShare = 0;

    rows.forEach((r, idx) => {
        const row = ws.getRow(5 + idx);
        const values = columns.map((c) => (c.accessor ? c.accessor(r) : r[c.key]));
        row.values = values;
        const moneyCols = columns
            .map((c, i) => (c.money ? i + 1 : null))
            .filter(Boolean);
        const centerCols = columns
            .map((c, i) => (c.center ? i + 1 : null))
            .filter(Boolean);
        styleDataRow(row, idx, { moneyCols, centerCols });

        totalRevenue += r.revenue || 0;
        totalOrders += r.orders || 0;
        totalCustomers += r.customers || 0;
        totalShare += r.vendorShare || 0;
    });

    const sumRow = ws.getRow(5 + rows.length);
    sumRow.values = columns.map((c, i) => {
        if (i === 0) return 'TỔNG CỘNG';
        if (c.key === 'revenue') return totalRevenue;
        if (c.key === 'orders') return totalOrders;
        if (c.key === 'customers') return '—';
        if (c.key === 'vendorShare') return totalShare;
        if (c.key === 'completed') return rows.reduce((s, r) => s + (r.completed || 0), 0);
        if (c.key === 'cancelled') return rows.reduce((s, r) => s + (r.cancelled || 0), 0);
        return '';
    });
    sumRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: C.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.brand } };
        applyBorder(cell);
        if ([2, 3, 4, 5].includes(colNumber) && typeof cell.value === 'number') {
            const col = columns[colNumber - 1];
            if (col?.money) cell.numFmt = '#,##0" đ"';
            cell.alignment = { horizontal: 'right' };
        }
        if (colNumber > 1 && typeof cell.value === 'number' && !columns[colNumber - 1]?.money) {
            cell.alignment = { horizontal: 'center' };
        }
    });
    sumRow.height = 24;

    return ws;
};

const MONTHLY_COLUMNS = [
    { header: 'Kỳ', key: 'label', width: 18 },
    { header: 'Khách hàng', key: 'customers', width: 14, center: true },
    { header: 'Lượt mua', key: 'orders', width: 12, center: true },
    { header: 'Doanh thu', key: 'revenue', width: 18, money: true },
    { header: 'Ví quầy (95%)', key: 'vendorShare', width: 18, money: true }
];

const YEARLY_COLUMNS = MONTHLY_COLUMNS;

const DAILY_COLUMNS = [
    { header: 'Ngày', key: 'label', width: 20, accessor: (r) => `${r.label}\n${r.date}` },
    { header: 'Lượt mua', key: 'orders', width: 12, center: true },
    { header: 'Hoàn thành', key: 'completed', width: 12, center: true },
    { header: 'Đã hủy', key: 'cancelled', width: 10, center: true },
    { header: 'Doanh thu', key: 'revenue', width: 18, money: true },
    { header: 'Ví quầy (95%)', key: 'vendorShare', width: 18, money: true }
];

const BESTSELLER_COLUMNS = [
    { header: 'Hạng', width: 8, accessor: (_, i) => i + 1, center: true },
    { header: 'Tên món', key: 'name', width: 28 },
    { header: 'Danh mục', key: 'category', width: 14 },
    { header: 'Đã bán', key: 'quantitySold', width: 10, center: true },
    { header: 'Doanh thu', key: 'revenue', width: 16, money: true }
];

const addBestSellerSheet = (wb, { vendor, items, periodLabel }) => {
    const ws = wb.addWorksheet('Món bán chạy', {
        views: [{ showGridLines: false }]
    });
    setColWidths(ws, BESTSELLER_COLUMNS.map((c) => c.width));

    styleBanner(
        ws,
        1,
        BESTSELLER_COLUMNS.length,
        'TOP MÓN BÁN CHẠY',
        `${vendor.name}  ·  ${periodLabel}`
    );

    const headerRow = ws.getRow(4);
    headerRow.values = BESTSELLER_COLUMNS.map((c) => c.header);
    styleHeaderRow(headerRow);

    (items || []).forEach((item, idx) => {
        const row = ws.getRow(5 + idx);
        row.values = BESTSELLER_COLUMNS.map((c) =>
            c.accessor ? c.accessor(item, idx) : item[c.key]
        );
        const moneyCols = BESTSELLER_COLUMNS.map((c, i) => (c.money ? i + 1 : null)).filter(Boolean);
        const centerCols = BESTSELLER_COLUMNS.map((c, i) => (c.center ? i + 1 : null)).filter(Boolean);
        styleDataRow(row, idx, { moneyCols, centerCols });
        if (idx === 0) {
            row.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
            });
        }
    });
};

async function buildVendorExcelWorkbook(payload) {
    const { vendor, overview, monthly, yearly, daily, bestSelling, salesPeriodLabel } = payload;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SlotHub';
    wb.created = new Date();
    wb.company = 'SlotHub FPT Canteen';

    addOverviewSheet(wb, { vendor, overview });

    addPeriodSheet(
        wb,
        'Theo tháng',
        'THỐNG KÊ THEO THÁNG',
        monthly || [],
        MONTHLY_COLUMNS
    );

    addPeriodSheet(
        wb,
        'Theo năm',
        'THỐNG KÊ THEO NĂM',
        yearly || [],
        YEARLY_COLUMNS
    );

    addPeriodSheet(
        wb,
        'Theo ngày',
        `DOANH THU THEO NGÀY (${daily?.length || 0} ngày)`,
        daily || [],
        DAILY_COLUMNS
    );

    addBestSellerSheet(wb, {
        vendor,
        items: bestSelling || [],
        periodLabel: salesPeriodLabel || 'Tháng hiện tại'
    });

    return wb;
}

async function buildVendorExcelBuffer(payload) {
    const wb = await buildVendorExcelWorkbook(payload);
    return wb.xlsx.writeBuffer();
}

function buildExportFilename(vendorName) {
    const date = new Date().toISOString().slice(0, 10);
    return `SlotHub_ThongKe_${safeFilePart(vendorName)}_${date}.xlsx`;
}

module.exports = {
    buildVendorExcelWorkbook,
    buildVendorExcelBuffer,
    buildExportFilename
};
