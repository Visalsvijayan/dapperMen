const Order=require('../../models/OrderSchema')
const Product=require('../../models/productSchema')
const moment=require('moment')

const getSelesReportPage=async(req,res)=>{
    try {

         //top 10 best selling products
         const topTenData=await Order.aggregate([
            {$unwind:"$orderItems"},
            {$lookup:{
                from:"products",
                localField:"orderItems.product",
                foreignField:"_id",
                as:"productDetails"

            }},
            { $unwind: "$productDetails" },
            {$lookup:{
                from:"categories",
                localField:"productDetails.category",
                foreignField:"_id",
                as:"categoryDetails"
            }},
            {$unwind:"$categoryDetails"},
            {$facet:{
                topProduct:[
                    {
                        $group:{
                            _id:"$orderItems.product",
                            name:{$first:"$productDetails.productName"},
                            totalQuantity:{$sum:"$orderItems.quantity"},
                            totalPrice:{$sum:"$orderItems.price"}
                        }
                    },
                    {$sort:{totalQuantity:-1}},
                    {$limit:10}
                ],
                topCategory:[
                    {$group:{
                        _id:"$categoryDetails._id",
                        name:{$first:"$categoryDetails.name"},
                        totalQuantity:{$sum:"$orderItems.quantity"},
                        totalPrice:{$sum:"$orderItems.price"}
                    }},
                    {$sort:{totalQuantity:-1}},
                    {$limit:10}
                ],
                topBrand:[
                    {
                        $group:{
                            _id:"$productDetails.brand",
                            name:{$first:"$productDetails.brand"},
                            totalQuantity:{$sum:"$orderItems.quantity"},
                            totalPrice:{$sum:"$orderItems.price"}
                        }
                    },
                    {$sort:{totalQuantity:-1}},
                    {$limit:10}
                ]
            }
                 
            }
        ])
         
       
        res.render('sales-report',{topTenData})
        
    } catch (error) {
        console.error('error in loading sales report page',error)
    }
    

}
 


const salesDashboardData = async (req, res) => {
    try {
        const { sort, start, end } = req.body;
        const daysOfWeek = {
            '1': 'Monday',
            '2': 'Tuesday',
            '3': 'Wednesday',
            '4': 'Thursday',
            '5': 'Friday',
            '6': 'Saturday',
            '7': 'Sunday'
        };

        let labels = [];
        let salesData = [];
        let query = {};

        // Determine the query based on filter selection
        switch (sort) {
            case 'daily':
                labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);  // Hourly labels
                query.createdOn = { $gte: moment().startOf('day').toDate(), $lt: moment().endOf('day').toDate() };
                break;

            case 'weekly':
                labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const startOfWeek = moment().startOf('week').toDate();
                const endOfWeek = moment().endOf('week').toDate();
                query.createdOn = { $gte: startOfWeek, $lt: endOfWeek };
                break;

            case 'monthly':
                labels = Array.from({ length: 31 }, (_, i) => i + 1);  // Date labels (1-31)
                query.createdOn = { $gte: moment().startOf('month').toDate(), $lt: moment().endOf('month').toDate() };
                break;

            case 'yearly':
                labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                query.createdOn = { $gte: moment().startOf('year').toDate(), $lt: moment().endOf('year').toDate() };
                break;

            case 'custom':
                if (!start || !end) {
                    return res.status(400).json({ message: 'Please provide both start and end dates.' });
                }
                query.createdOn = { $gte: moment(start).toDate(), $lt: moment(end).toDate() };
                labels = generateCustomLabels(start, end);  // Create custom labels based on date range
                break;

            default:
                return res.status(400).json({ message: 'Invalid filter selected' });
        }

        let groupFormat = '%H'; // Default hourly for 'daily'

        switch (sort) {
            case 'daily':
                groupFormat = '%H'; // Group by hour (0-23)
                break;
            case 'weekly':
                groupFormat = '%u'; // Group by day of week (1 = Monday, ..., 7 = Sunday)
                break;
            case 'monthly':
                groupFormat = '%d'; // Group by day of month (01-31)
                break;
            case 'yearly':
                groupFormat = '%m'; // Group by month (01-12)
                break;
            case 'custom':
                groupFormat = '%Y-%m-%d'; // Group by full date (example: 2025-04-26)
                break;
        }

        const sales = await Order.aggregate([
            { $match: query },
            { $unwind: "$orderItems" },  // Unwind orderItems to access productOfferAmount
            { 
              $group: {
                _id: { $dateToString: { format: groupFormat, date: '$createdOn',timezone: "+05:30" } },  // Group by hour (or change format for daily/weekly)
                totalSales: { $sum: '$finalAmount' },
                couponDiscounts: { $sum: '$discount' },
                productOfferDiscount: { $sum: '$orderItems.productOfferAmount' },
                numberOfProduct: { $sum: '$orderItems.quantity' },
                orderIds: { $addToSet: '$_id' }
              }
            },
            {
              $addFields: {
                totalDiscount: { $add: ["$couponDiscounts", "$productOfferDiscount"] }, // Add coupon + product offer
                numberOfOrders: { $size: "$orderIds" }
              }
            },
            { $sort: { '_id': 1 } }  // Sort by hour/day
        ]);

        let couponDiscountData = [];
        let productDiscountData = [];
        let totalDiscountData = [];
        let netSale = 0;
        let netCoupon = 0;
        let netProductOffer = 0;
        let netDiscount = 0;
        let quantity = 0;
        let totalOrders = 0;

        const salesMap = {};
        sales.forEach(item => {
            salesMap[item._id] = item;
        });

        labels.forEach((label, index) => {
            let key;
            if (sort === 'weekly') {
                key = (index + 1).toString(); // 1 for Monday
            } else if (sort === 'monthly') {
                key = (index + 1).toString().padStart(2, '0');
            } else if (sort === 'yearly') {
                key = (index + 1).toString().padStart(2, '0');
            } else if (sort === 'daily') {
                key = index.toString().padStart(2, '0');
            } else if (sort === 'custom') {
                key = label;
            }

            const item = salesMap[key];

            salesData.push(item ? item.totalSales : 0);
            couponDiscountData.push(item ? item.couponDiscounts : 0);
            productDiscountData.push(item ? item.productOfferDiscount : 0);
            totalDiscountData.push(item ? item.totalDiscount : 0);
        });

        // Calculate totals
        sales.forEach(item => {
            netSale += item.totalSales;
            netCoupon += item.couponDiscounts;
            netProductOffer += item.productOfferDiscount;
            netDiscount += item.totalDiscount;
            quantity += item.numberOfProduct;
            totalOrders += item.numberOfOrders;
        });

        // Payment method aggregation for the pie chart
        const paymentData = await Order.aggregate([
            { $match: query },
            { 
              $group: {
                _id: '$payment',   
                count: { $sum: 1 }         
              }
            }
        ]);

        // Convert payment data into a format suitable for the pie chart
        let paymentMethodData = paymentData.map(item => ({
            label: item._id,
            count: item.count
        }));

       
        // Calculate percentages
        const totalPaymentOrders = paymentMethodData.reduce((total, method) => total + method.count, 0);
        
        paymentMethodData = paymentMethodData.map(item => ({
            ...item,
            percentage: ((item.count / totalPaymentOrders) * 100).toFixed(2)
        }));

       
        return res.json({
            labels,
            salesData,
            couponDiscountData,
            productDiscountData,
            totalDiscountData,
            netSale,
            netCoupon,
            netProductOffer,
            netDiscount,
            quantity,
            totalOrders,
            paymentMethodData //pichart data
            
        });
    } catch (error) {
        console.error('Error in sales report', error);
    }
}

function generateCustomLabels(startDate, endDate) {
  const start = moment(startDate);
  const end = moment(endDate);
  const labels = [];
  while (start.isBefore(end)) {
    labels.push(start.format('YYYY-MM-DD'));  // Or any other custom format
    start.add(1, 'days');
  }
   
  return labels;
}



//table data


const salesTableData=async(req,res)=>{
    try {
        const {sortBy,startDate,endDate}=req.body
        let query = {};
        
        

        switch (sortBy) {
            case 'daily':
                
                query.createdOn = { $gte: moment().startOf('day').toDate(), $lt: moment().endOf('day').toDate() };
                break;

            case 'weekly':
                 
                const startOfWeek = moment().startOf('week').toDate();
                const endOfWeek = moment().endOf('week').toDate();
                query.createdOn = { $gte: startOfWeek, $lt: endOfWeek };
                break;

            case 'monthly':
 
                query.createdOn = { $gte: moment().startOf('month').toDate(), $lt: moment().endOf('month').toDate() };
                break;

            case 'yearly':
                
                query.createdOn = { $gte: moment().startOf('year').toDate(), $lt: moment().endOf('year').toDate() };
                break;

            case 'custom':
                if (!startDate || !endDate) {
                    return res.status(400).json({ message: 'Please provide both start and end dates.' });
                }
                query.createdOn = { $gte: moment(startDate).toDate(), $lt: moment(endDate).toDate() };
                
                break;

            default:
                return res.status(400).json({ message: 'Invalid filter selected' });
        }


        const salesData=await Order.aggregate([
            {$match:query},
            {$unwind:"$orderItems"},
            {$lookup:{
                from:"users",
                localField:"userId",
                foreignField:"_id",
                as:"userDetails"
                
              }
            },
            {
            
                $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } // Unwind userDetails to get customer info
    
            },
            {
                $addFields: {
                    totalProductOfferAmount: "$orderItems.productOfferAmount",  // Total product offer amount for each order item
                    totalDiscount: "$discount" // The single discount value for the entire order
                }
            },
            {
                $addFields: {
                    totalOfferAmount: {
                        $add: ["$totalProductOfferAmount", "$totalDiscount"]  // Sum of product offer amount + discount for each order
                    }
                }
            },
            {
                $group: {
                    _id: "$_id",  
                    orderId: { $first: "$orderId" },
                    orderItems: { $push: "$orderItems" },
                    userName: { $first: "$userDetails.name" }, 
                    finalAmount: { $first: "$finalAmount" },
                    totalPrice: { $first: "$totalPrice" },
                    discount: { $first: "$discount" },
                    createdOn: { $first: "$createdOn" },
                    status: { $first: "$status" },
                    payment:{$first:"$payment"},
                    totalOfferAmount: { $first: "$totalOfferAmount" }
                }
            }
        ])

    const salesSummery=await Order.aggregate([
            {$match:query},
            {$unwind:"$orderItems"},
            {$group:{
                _id:null,
                netSale:{$sum:"$finalAmount"},
                netCoupon:{$sum:"$discount"},
                netProductOffer:{$sum:"$orderItems.productOfferAmount"},
                totalOrder:{$sum:1},
                numberOfProducts:{$sum:"$orderItems.quantity"}
            }

            }
    ])
     
       
        

        res.render('sale-tableData',{
            salesData,
            salesSummery,
            startDate,endDate,sortBy
        })
    } catch (error) {
        console.error('error in sales table',error)
        
    }
}
module.exports={
    getSelesReportPage,
    salesDashboardData,
    salesTableData

}