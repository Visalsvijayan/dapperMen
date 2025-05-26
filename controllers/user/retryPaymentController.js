const Order=require('../../models/orderSchema')
const Product=require('../../models/productSchema');
const User=require('../../models/userSchema')
const razorpayInstance=require('../../config/razorpay')
const crypto = require('crypto');
const StatusCode=require('../../config/statusCode')
 const validateStock = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    const order = await Order.findOne({_id:orderId });
     
    if (!order) {
      return res.status(400).json({ success: false, message: 'Order not found' });
    }

    for (const item of order.orderItems) {
      const product = await Product.findById(item.product);

      if (!product || product.quantity < item.quantity) {
        return res.status(400).json({ success: false, message: 'Insufficient stock',orderId:order.orderId });
      }
    }

    // All items passed stock check
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error validating stock:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const walletPayment=async(req,res)=>{
    try {
        const orderId=req.params.orderId;
        const userId=req.session.user;
        const user=await User.findById(userId);
        const order=await Order.findById(orderId)
        const finalAmount=order.finalAmount;
        for(let item of order.orderItems){
           const product=await Product.findById(item.product)
           if(!product || product.quantity<item.quantity){
              return res.status(400).json({ success: false, message: 'Insufficient stock For the Product. Please try later'});
           }
        }
        if(order.finalAmount>user.wallet.balance){
          return res.status(400).json({success:false,message:'Insufficient Balance in Wallet'})
        }
        order.status='Pending';
        order.paymentStatus='Paid';
        order.payment='wallet';
        await order.save();
        await User.findByIdAndUpdate(userId,{
           $inc:{"wallet.balance":-finalAmount},
           $push:{orderHistory:order._id,
          "wallet.transactions":{
              amount:finalAmount,
              date:new Date,
              status:'Debited',
          }}
        })

        res.status(200).json({success:true})

    } catch (error) {
        res.status(500).json({success:false,message:'Internal server error'})

    }
}

const cashOnDelivery=async(req,res)=>{
  try {
   const orderId=req.params.orderId;
   const userId=req.session.user;
   const user=await User.findById(userId);
   const order=await Order.findById(orderId)
   const finalAmount=order.finalAmount;
   for(let item of order.orderItems){
      const product=await Product.findById(item.product)
      if(!product || product.quantity<item.quantity){
        return res.status(400).json({ success: false, message: 'Insufficient stock For the Product. Please try later'});
      }
    }
  if(order.finalAmount>1000){
    return res.status(400).json({success:false,message:'Cash On Delivery Upto 1000 Rupees Only'})
  }
  order.status='Pending';
  order.payment='cod'; 
  order.paymentStatus=''
  await order.save()
  res.status(200).json({success:true})
  } catch (error) {
     res.status(500).json({success:false,message:'Internal server error'})
  }
}
const razorpayPayment=async(req,res)=>{
  try {
    const orderId=req.params.orderId;
    const order=await Order.findById(orderId);
    const finalAmount=order.finalAmount
    for(let item of order.orderItems){
      const product=await Product.findById(item.product)
      if(!product || product.quantity<item.quantity){
        return res.status(400).json({ success: false, message: 'Insufficient stock For the Product. Please try later'});
      }
    }
    const options={
      amount:finalAmount*100,
      currency:"INR",
      receipt:"order_rcptid-" + Math.floor(Math.random()*10000) 
    };
    const razorpayOrder=await razorpayInstance.orders.create(options);
     

    return res.status(200).json({
      success:true,
      key_id:process.env.RAZORPAY_KEY_ID,
      amount:options.amount,
      orderId:order._id,
      razorpayOrder,
      orderIdViewOrder:order.orderId
    })
    
  } catch (error) {
     
    console.error('error in razorpay retrypayment')
  
     return res.status(500).json({success:false,message:'Internal server error'})
  }
}
const verifyRazorpay=async(req,res)=>{
  try {
    const orderId=req.params.orderId;
     
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature  
      
    } = req.body;
     
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");
    if (generatedSignature === razorpay_signature) {
         
      const updatedOrder = await Order.findByIdAndUpdate(orderId, {
            paymentStatus: "Paid",
            razorpay: {
              order_id: razorpay_order_id,
              payment_id: razorpay_payment_id,
              signature: razorpay_signature
            },
            status: "Pending"
      }, { new: true });
    
          //reduce stock
      for(let item of updatedOrder.orderItems){
            const product=await Product.findById(item.product)
            if(product){
              product.quantity=Math.max(product.quantity- item.quantity, 0);
              await product.save();
            }
        }
         
          //  Deactivate referral coupon if used
      if (updatedOrder.discount > 0) {
            const refCoupon = await Coupon.findOne({
              isReferrCoupon: true,
              isActive: true,
              userId: req.session.user._id
            });
    
            if (refCoupon) {
              await Coupon.updateOne(
                { _id: refCoupon._id },
                { $set: { isActive: false } }
              );
            }
       }
     
     return res.status(200).json({ success: true, orderId:updatedOrder.orderId});
    } else {
           
        return res.status(400).json({ success:false,orderId:updatedOrder.orderId});
    }
  } catch (error) {
     console.error('error in verifying retrypayment',errir)
    
  }
}
module.exports={
    validateStock,
    walletPayment,
    cashOnDelivery,
    razorpayPayment,
    verifyRazorpay
    
}