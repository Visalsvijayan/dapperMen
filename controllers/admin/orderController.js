const Product=require('../../models/productSchema')
const User=require('../../models/userSchema')
const Order=require('../../models/orderSchema')
const Address=require('../../models/addressSchema')

const getOrdersPage=async(req,res)=>{
  
    try {
        const { search = '', status = '', sort = '', page = 1 } = req.query;
        const perPage = 7;
        const currentPage = parseInt(page) || 1;
    
        const matchStage = {};
        if (status) matchStage.status = status;
    
        if (search) {
          const searchRegex = new RegExp(search, 'i');
          matchStage.$or = [
            { orderId: { $regex: searchRegex } },
            { 'user.name': { $regex: searchRegex } } // will be populated via aggregate
          ];
        }
    
        // Sort options
        let sortStage = { createdOn: -1 }; // Default: Newest
        if (sort === 'oldest') sortStage = { createdOn: 1 };
        if (sort === 'highest') sortStage = { finalAmount: -1 };
        if (sort === 'lowest') sortStage = { finalAmount: 1 };
    
        // Aggregation pipeline
        const pipeline = [
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $unwind: '$user'
          },
          {
            $match: matchStage
          },
          {
            $sort: sortStage
          },
          {
            $facet: {
              paginatedResults: [
                { $skip: (currentPage - 1) * perPage },
                { $limit: perPage }
              ],
              totalCount: [
                { $count: 'count' }
              ]
            }
          }
        ];
    
        const result = await Order.aggregate(pipeline);
        const orders = result[0].paginatedResults;
        const totalCount = result[0].totalCount[0]?.count || 0;
        const totalPages = Math.ceil(totalCount / perPage);
    
        res.render('order-management', {
          orders,
          currentPage,
          totalPages,
          search,
          status,
          sort
        });
      } catch (error) {
        console.error('Error in getOrdersPage:', error);
        res.redirect('/admin/pageerror');
      }
}
const orderDetails=async(req,res)=>{
    try {
        const userId=req.query.userId;
        const orderId=req.query.orderId;
         
        const userData=await User.find({_id:userId});
       
        const orderData=await Order.find({orderId:orderId})
                        .populate('orderItems.product') 
        const addressid=orderData[0].address 
        const myAddres= await Address.findOne(
            { userId: userId},
            {
              address: {
                $elemMatch: { _id: addressid }
              }
            }
          );  
        
        res.render('order-Details',{
            orders:orderData,
            user:userData[0],
            address:myAddres.address[0]
        })
    } catch (error) {
        console.error('error in getting order details',error)
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const UpdateOrderStatus=async(req,res)=>{
    try {
        const {orderId}=req.params;
        const {status}=req.body;
        if(status==='Delivered'){
          const deliverdAt=new Date();
          await Order.findByIdAndUpdate(orderId,{status,deliverdAt},{ runValidators: true });
          return res.json({success:true});

        }
        await Order.findByIdAndUpdate(orderId,{status},{ runValidators: true });
        res.json({success:true});
        
    } catch (error) {
        console.error("Status update error",error)
        res.redirect('/admin/pageerror')
        
    }
}
const approveReturnOrder=async(req,res)=>{
    try {
        const {orderId}=req.params;
        let finalAmount=0;
        const orders=await Order.findById(orderId).populate('orderItems.product')
        const payment=orders.payment;
        for(let item of orders.orderItems){
          if(item.productStatus!=='Cancelled'){
            const productId=item.product._id;
            const qty=item.quantity;
            await Product.findByIdAndUpdate(productId, {
              $inc: { quantity: qty }
            });
            finalAmount+=item.price * item.quantity
          }
        }

        await Order.findByIdAndUpdate(orderId, { status: 'Returned' });
        if(payment==='wallet' || payment==='cod' || payment==='razorpay'){
          await User.findByIdAndUpdate(orders.userId,{
            $inc:{"wallet.balance":finalAmount},
            $push:{
              "wallet.transactions":{
                date:new Date(),
                status:'Credited',
                amount:finalAmount
              }
            }
          })

        }
        
        res.json({ success: true });
         
    } catch (error) {
        console.error('error in getting order details',error)
        res.status(500).json({ success: false, message: "Internal server error" }); 
    }
}
const rejectReturnOrder=async(req,res)=>{
    try {
        const {orderId}=req.params;
        await Order.findByIdAndUpdate(orderId, { status: 'Reject Return Request' });
        res.json({ success: true });
        
    } catch (error) {
        console.error('error in getting order details',error)
        res.status(500).json({ success: false, message: "Internal server error" }); 
    }
}
module.exports={
    getOrdersPage,
    orderDetails,
    UpdateOrderStatus,
    approveReturnOrder,
    rejectReturnOrder

}