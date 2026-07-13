const mongoose = require('mongoose');
const PLATFORM_FEE_RATE = 0.05;
const VENDOR_SHARE = 1 - PLATFORM_FEE_RATE;

const TZ = 'Asia/Ho_Chi_Minh';

const paidOrderMatch = (vendorId, dateRange = null) => {
    const match = {
        vendor: new mongoose.Types.ObjectId(vendorId),
        paymentStatus: 'Paid',
        status: { $ne: 'Cancelled' }
    };
    if (dateRange?.start || dateRange?.end) {
        match.createdAt = {};
        if (dateRange.start) match.createdAt.$gte = dateRange.start;
        if (dateRange.end) match.createdAt.$lt = dateRange.end;
    }
    return match;
};

const aggregatePeriodStats = async (vendorId, dateRange) => {
    const rows = await mongoose.model('Order').aggregate([
        { $match: paidOrderMatch(vendorId, dateRange) },
        {
            $group: {
                _id: null,
                revenue: { $sum: '$totalPrice' },
                orders: { $sum: 1 },
                customers: { $addToSet: '$user' }
            }
        },
        {
            $project: {
                _id: 0,
                revenue: 1,
                orders: 1,
                customers: { $size: '$customers' },
                vendorShare: { $round: [{ $multiply: ['$revenue', VENDOR_SHARE] }, 0] }
            }
        }
    ]);
    return rows[0] || { revenue: 0, orders: 0, customers: 0, vendorShare: 0 };
};

const startOfDay = (d = new Date()) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const startOfMonth = (y, m) => new Date(y, m, 1);
const startOfYear = (y) => new Date(y, 0, 1);

const pctChange = (current, previous) => {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
};

const monthLabel = (year, month) => `Tháng ${month}/${year}`;

const buildOverviewPeriods = (now = new Date()) => {
    const y = now.getFullYear();
    const m = now.getMonth();
    return {
        today: { start: startOfDay(now), end: null },
        thisMonth: { start: startOfMonth(y, m), end: null },
        lastMonth: { start: startOfMonth(y, m - 1), end: startOfMonth(y, m) },
        thisYear: { start: startOfYear(y), end: null },
        lastYear: { start: startOfYear(y - 1), end: startOfYear(y) },
        allTime: { start: null, end: null }
    };
};

const getVendorOverview = async (vendorId) => {
    const periods = buildOverviewPeriods();
    const keys = Object.keys(periods);
    const results = await Promise.all(
        keys.map((key) => aggregatePeriodStats(vendorId, periods[key]))
    );
    const overview = {};
    keys.forEach((key, i) => {
        overview[key] = results[i];
    });
    overview.comparisons = {
        revenueMonthChange: pctChange(overview.thisMonth.revenue, overview.lastMonth.revenue),
        ordersMonthChange: pctChange(overview.thisMonth.orders, overview.lastMonth.orders),
        customersMonthChange: pctChange(overview.thisMonth.customers, overview.lastMonth.customers),
        revenueYearChange: pctChange(overview.thisYear.revenue, overview.lastYear.revenue),
        ordersYearChange: pctChange(overview.thisYear.orders, overview.lastYear.orders)
    };
    return overview;
};

const getVendorMonthlyStats = async (vendorId, monthsBack = 12) => {
    const now = new Date();
    const start = startOfMonth(now.getFullYear(), now.getMonth() - (monthsBack - 1));

    const rows = await mongoose.model('Order').aggregate([
        { $match: paidOrderMatch(vendorId, { start }) },
        {
            $group: {
                _id: {
                    year: { $year: { date: '$createdAt', timezone: TZ } },
                    month: { $month: { date: '$createdAt', timezone: TZ } }
                },
                revenue: { $sum: '$totalPrice' },
                orders: { $sum: 1 },
                customers: { $addToSet: '$user' }
            }
        },
        {
            $project: {
                _id: 0,
                year: '$_id.year',
                month: '$_id.month',
                revenue: 1,
                orders: 1,
                customers: { $size: '$customers' },
                vendorShare: { $round: [{ $multiply: ['$revenue', VENDOR_SHARE] }, 0] }
            }
        },
        { $sort: { year: 1, month: 1 } }
    ]);

    const map = new Map(rows.map((r) => [`${r.year}-${r.month}`, r]));

    const monthly = [];
    for (let i = 0; i < monthsBack; i++) {
        const d = startOfMonth(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i));
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const key = `${year}-${month}`;
        const row = map.get(key);
        monthly.push({
            year,
            month,
            key,
            label: monthLabel(year, month),
            revenue: row?.revenue || 0,
            orders: row?.orders || 0,
            customers: row?.customers || 0,
            vendorShare: row?.vendorShare || 0
        });
    }
    return monthly;
};

const getVendorYearlyStats = async (vendorId) => {
    const rows = await mongoose.model('Order').aggregate([
        { $match: paidOrderMatch(vendorId) },
        {
            $group: {
                _id: { year: { $year: { date: '$createdAt', timezone: TZ } } },
                revenue: { $sum: '$totalPrice' },
                orders: { $sum: 1 },
                customers: { $addToSet: '$user' }
            }
        },
        {
            $project: {
                _id: 0,
                year: '$_id.year',
                revenue: 1,
                orders: 1,
                customers: { $size: '$customers' },
                vendorShare: { $round: [{ $multiply: ['$revenue', VENDOR_SHARE] }, 0] }
            }
        },
        { $sort: { year: 1 } }
    ]);

    return rows.map((r) => ({
        ...r,
        label: `Năm ${r.year}`
    }));
};

const getVendorDailyStats = async (vendorId, days = 30) => {
    const VENDOR_SHARE = 0.95;
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const labelMap = {};
    for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = d.toLocaleDateString('en-CA', { timeZone: TZ });
        const label = d.toLocaleDateString('vi-VN', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            timeZone: TZ
        });
        labelMap[key] = {
            date: key,
            label,
            revenue: 0,
            orders: 0,
            completed: 0,
            cancelled: 0,
            vendorShare: 0
        };
    }

    const rows = await mongoose.model('Order').aggregate([
        { $match: paidOrderMatch(vendorId, { start }) },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$createdAt',
                        timezone: TZ
                    }
                },
                revenue: { $sum: '$totalPrice' },
                orders: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } }
            }
        }
    ]);

    rows.forEach((row) => {
        if (!labelMap[row._id]) return;
        const revenue = row.revenue || 0;
        labelMap[row._id].revenue = revenue;
        labelMap[row._id].orders = row.orders || 0;
        labelMap[row._id].completed = row.completed || 0;
        labelMap[row._id].cancelled = row.cancelled || 0;
        labelMap[row._id].vendorShare = Math.round(revenue * VENDOR_SHARE);
    });

    return Object.values(labelMap).sort((a, b) => a.date.localeCompare(b.date));
};

const getVendorBestSelling = async (vendorId, startDate) => {
    return mongoose.model('Order').aggregate([
        {
            $match: {
                vendor: new mongoose.Types.ObjectId(vendorId),
                paymentStatus: 'Paid',
                status: { $ne: 'Cancelled' },
                createdAt: { $gte: startDate }
            }
        },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.menuItem',
                quantitySold: { $sum: '$items.quantity' },
                revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
            }
        },
        { $sort: { quantitySold: -1 } },
        { $limit: 15 },
        {
            $lookup: {
                from: 'menuitems',
                localField: '_id',
                foreignField: '_id',
                as: 'menuItem'
            }
        },
        { $unwind: { path: '$menuItem', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 0,
                name: { $ifNull: ['$menuItem.name', 'Món đã xóa'] },
                category: { $ifNull: ['$menuItem.category', ''] },
                quantitySold: 1,
                revenue: 1
            }
        }
    ]);
};

module.exports = {
    aggregatePeriodStats,
    getVendorOverview,
    getVendorMonthlyStats,
    getVendorYearlyStats,
    getVendorDailyStats,
    getVendorBestSelling,
    pctChange
};
