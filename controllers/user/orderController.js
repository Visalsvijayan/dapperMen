const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");
 
const mongoose=require('mongoose')
const Product=require('../../models/productSchema')
const Cart=require('../../models/cartSchema')
const Coupon=require('../../models/couponSchema')
const Order=require('../../models/orderSchema')
const { v4: uuidv4 } = require('uuid');
const razorpayInstance=require('../../config/razorpay')
const crypto = require('crypto');
const StatusCodes = require("../../config/statusCode");

const deliveryCharge=50;
const getCheckoutPage=async(req,res)=>{
    try {
         
        const user=req.session.user._id;
        const findUser=await User.findOne({_id:user})
        const addressData=await Address.findOne({userId:user})
        // const couponData=await Coupon.find({isActive:true})
         const oid=new mongoose.Types.ObjectId(user)
  
        const data=await User.aggregate([
            {$match:{_id:oid}},
            {$lookup:{
                from:"carts",
                localField:'cart',
                foreignField:'_id',
                as:'cartDetails'
            }},
            {$unwind:"$cartDetails"},
            {$unwind:"$cartDetails.items"},
            {$lookup:{
                from:"products",
                localField:"cartDetails.items.productId",
                foreignField:"_id",
                as:"productDetails"
            }},
            {$unwind:"$productDetails"},
            {$addFields:{
                "cartDetails.itemTotal":{
                    $multiply:["$productDetails.salePrice","$cartDetails.items.quantity"]
                }
            }},
            {$group:{
                _id:null,
                grandTotal:{$sum:"$cartDetails.itemTotal"},
                allItem:{$push:{
                    product:"$productDetails",
                    cartItem:"$cartDetails.items",
                    itemTotal:"$cartDetails.itemTotal"
                }}
            }}
             
        ])

        //coupons passing to checkout page

        const allCoupons = await Coupon.find({ isActive: true });

       
        const referralCoupons = allCoupons.filter(coupon => 
          coupon.name.startsWith('REF-') && coupon.userId?.toString() === user.toString()
        );
  
        
  
        
        const nonReferralCoupons = allCoupons.filter(coupon => 
          !coupon.name.startsWith('REF-') && data[0].grandTotal > coupon.minimumPrice
        );
   
        const availableCoupons = [...nonReferralCoupons, ...referralCoupons];

         
        if(data.length>0 && data[0].allItem && data[0].allItem.length>0){
            
            let finalAmount=(data[0].grandTotal)+deliveryCharge
            finalAmount=Math.round(finalAmount)
            res.status(StatusCodes.SUCCESS).render('checkoutPage',{
                data,
                user:findUser,
                isCart:true,
                userAddress:addressData,
                coupons:availableCoupons,
                deliveryCharge,
                finalAmount

            })
        }
        else{
            res.status(StatusCodes.SUCCESS).render('checkoutPage', {
              data: [],
              coupons:[],
              user: findUser,
              isCart: false,  
              userAddress: addressData
          });

        }
        
    } catch (error) {
        console.error('error in checkout',error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).redirect('/pageNotFound')
        
    }
}
const deleteProduct=async(req,res)=>{
    try {
        const productId=req.query.id;
        const userId=await req.session.user._id;
         
        const updateCart=await Cart.findOneAndUpdate(
            {userId:userId},
            {$pull:{items:{productId:productId}}},
            {new:true}
        ).populate('items.productId');
        if(!updateCart){
            return res.status(404).json({success:false,message:'cart not found'})

        }
        const reducedCart= await Cart.findOne({userId:userId})
        const remainingItems=reducedCart.items.length
        
        res.status(StatusCodes.SUCCESS).json({
            success:true,
            message:'Item removed from cart',
            cart:updateCart,
            remainingItems
        })

    } catch (error) {
        console.error('error in removing item from cart:',error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({success:false,message:'server error'});
        
    }
}

 
async function prepareOrderData(req){
  const { totalPrice,finalAmount,createdOn, date, addressId, payment, discount,couponName} = req.body;
  const userId = req.session.user._id;
  let walletAmount=req.body.walletAmount
  walletAmount=parseInt(walletAmount)
  // Find user and populate cart details
  const userDetails = await User.findById(userId)
      .populate({
          path: "cart",
          populate: {
              path: "items.productId",
              model: "Product"
          }
      })
      .lean();

  if (!userDetails) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "User not found" });
  }

   
  if (!userDetails.cart.length) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Cart is empty" });
  }

   
  const productIds = userDetails.cart[0].items.map(item => item.productId._id);
  
  // Find address
  const findAddress = await Address.findOne({ userId, "address._id": addressId });
  if (!findAddress) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Address not found" });
  }

  // Find products in the cart
  const findProducts = await Product.find({ _id: { $in: productIds } });
  if (findProducts.length !== productIds.length) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Some products are not found" });
  }
   
  const couponApplied= discount>0 ? true:false
  if(couponApplied){
    const refCoupon= await Coupon.findOne({isReferrCoupon:true,isActive:true,userId:userId})
    if(refCoupon){
      await Coupon.updateOne({isReferrCoupon:true,isActive:true,userId:userId},
        {$set:{isActive:false}}
      )
    }

  }

  // Preparing order items
  const orderedProducts = findProducts.map(item => ({
      _id: item._id,
      price: item.salePrice,
      offerAmount:item.offerAmount,
      name: item.productName,
      image: item.productImage[0],
      productStatus: "Confirmed",
      quantity: userDetails.cart[0].items.find(cartItem => cartItem.productId._id.toString() === item._id.toString()).quantity,
  }));

  
   

  // Create order
  const newOrder = new Order({
      orderId: uuidv4(),
      userId: userId,
      orderItems: orderedProducts.map(product => ({
          product: product._id,
          quantity: product.quantity,
          price: product.price,
          productOfferAmount: product.offerAmount 
      })),
      totalPrice,
      discount: discount || 0,
      finalAmount,
      address: findAddress.address.find(a => a._id.toString() === addressId.toString()), // Fetch the correct address
      status: "Pending",
      createdOn: new Date(),
      couponApplied: couponApplied,
      payment,
      userId,
      couponName
       
  });
  //reduce stock
  for(let item of newOrder.orderItems ){
      await Product.findByIdAndUpdate(item.product,{
          $inc:{quantity:-item.quantity}
      })
  }

  // return {newOrder,finalAmount,userId,walletAmount}
  return { 
    newOrder, 
    finalAmount, 
    userId, 
    walletAmount 
  }
}


const placeOrderCOD=async(req,res)=>{
  try {
  
    const {newOrder,finalAmount,userId}=await prepareOrderData(req)
 
    
    const orderDone = await newOrder.save();
    await User.findByIdAndUpdate(userId, {
        $push: { orderHistory: newOrder._id }
    });

    // Clear the user's cart
    await Cart.updateOne({userId:userId }, { $set: { items: [] } });
    return res.status(StatusCodes.SUCCESS).json({
        success: true,
        redirect: `/place-order-success?orderId=${newOrder.orderId}`,
        orderId: orderDone._id
    });
    
  } catch (error) {
    console.error("Error in placing order:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({success:false})
    
  }
  
}

const placeOrderWallet=async(req,res)=>{
  try {
    const {newOrder,finalAmount,userId,walletAmount}=await prepareOrderData(req)
    if(walletAmount<finalAmount){
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "Insufficient wallet balance"
        });
    }
    const orderDone=await newOrder.save();  //order saved
    await User.findByIdAndUpdate(userId,{      //updating user
            
      $inc:{"wallet.balance":-finalAmount},
      $push:{orderHistory:orderDone._id,
          "wallet.transactions":{
        amount:finalAmount,
        date:new Date,
        status:'Debited',
      }}
    })
    await Cart.updateOne({userId:userId }, { $set: { items: [] } });
    return res.status(StatusCodes.CREATED).json({
        success: true,
        redirect: `/place-order-success?orderId=${newOrder.orderId}`,
        orderId: orderDone._id
    });
             
  } catch (error) {
    console.error("Error in placing order:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({success:false})
  }
}

const placeOrderRazorpay=async(req,res)=>{
  try {
    

    const {newOrder,finalAmount,userId}=await prepareOrderData(req)
     
    const options={
      amount:finalAmount*100,
      currency:"INR",
      receipt:"order_rcptid-" + Math.floor(Math.random()*10000) 
    };
    const razorpayOrder=await razorpayInstance.orders.create(options);
    
    return res.status(StatusCodes.SUCCESS).json({
      success:true,
      key_id:process.env.RAZORPAY_KEY_ID,
      amount:options.amount,
      orderData:newOrder,
      razorpayOrder
    })
    
  } catch (error) {
    console.error('error in place order Razorpay',error)
    
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Something went wrong while placing the order. Please try again later.',
      error: error.message || 'Internal Server Error'
    });
    
  }
}
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderData, //  orderData from frontend
    } = req.body;
    

    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    const userDetails=await User.findById(req.session.user._id).populate('cart')
   
    const productIds = userDetails.cart[0].items.map(item => item.productId._id);
    const findProducts = await Product.find({ _id: { $in: productIds } });
     
    const orderedProducts = findProducts.map(item => ({
      _id: item._id,
      price: item.salePrice,
      quantity: userDetails.cart[0].items.find(cartItem => cartItem.productId._id.toString() === item._id.toString()).quantity,
      offerAmount:item.offerAmount
    }));
    if (findProducts.length !== productIds.length) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: "Some products are not found" });
    }
    //order creation
    if (generatedSignature === razorpay_signature) {
      const newOrder = new Order({
        ...orderData,
        status: "Pending",
        paymentStatus: "Paid",
        orderItems: orderedProducts.map(product => ({
          product: product._id,
          quantity: product.quantity,
          price: product.price,
          productOfferAmount:product.offerAmount
        })),
        userId:req.session.user._id,
        razorpay: {
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
          signature: razorpay_signature
        }
      });

      const savedOrder = await newOrder.save();
     
      //  Deactivate referral coupon if used
     if (orderData.discount > 0) {
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

      await User.findByIdAndUpdate(savedOrder.userId, {
        $push: { orderHistory: savedOrder._id }
      });

      // Clear cart
      await Cart.updateOne({ userId: savedOrder.userId }, { $set: { items: [] } });

      return res.status(StatusCodes.SUCCESS).json({ success: true, orderId: savedOrder.orderId });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error("Error in verifyPayment:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false });
  }
};

const applyCoupon=async(req,res)=>{
  try {
    const couponName=req.body.couponName;
    const subtotal=req.body.subtotal;
     
    const coupon=await Coupon.findOne({name:couponName})
    const type=coupon.discountType;
    const offer=coupon.offer;
    
    let discountedPrice
    let discount
    
    if(type==='Fixed'){
        discountedPrice=Math.round(subtotal-offer+deliveryCharge);
        discount=Math.round(offer)

    }
    else{
      
      discountedPrice=Math.round( subtotal*((100-offer)/100) + deliveryCharge)
      discount=Math.round(subtotal*(offer/100))
      if(discount>coupon.maxDiscount){
        const maxDiscount=coupon.maxDiscount;
        discount=maxDiscount;
        discountedPrice=subtotal + deliveryCharge-discount

      }
    }
    res.status(StatusCodes.SUCCESS).json({success:true,discountedPrice,discount})
  } catch (error) {
    console.error('error in apply coupon',error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({success:false,discountedPrice:''})
    
  }
}

const placeOrderSuccess=async(req,res)=>{
   
    try {
        const userId=req.session.user._id;
        const orderId=req.query.orderId;
       
        const orderDetails=await Order.findOne({orderId:orderId})
        
        const totalPrice=orderDetails.totalPrice;
        const payment=orderDetails.payment;
        const addressId=orderDetails.address;
        const myAddres= await Address.findOne(
            { userId: userId },
            {
              address: {
                $elemMatch: { _id: addressId }
              }
            }
          );
        const selectedAddress = myAddres.address[0];  
        const formattedDate = new Date(orderDetails.createdOn).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
            

        res.render('order-placedNew',{orid:orderId,address:selectedAddress,payment:payment,totalPrice:totalPrice,date:formattedDate})
    } catch (error) {
        console.error('error loading order placed succes page',error)
        res.status(StatusCodes.NOT_FOUND).redirect('/pageNotFound');
    }
}

const orderDetailPage=async(req,res)=>{
    try {
        const userId=req.session.user;
        const orderId=req.query.orderId
        
        const orderData= await Order.findOne({orderId:orderId})
    
                        .populate({
                        path: 'orderItems.product',
                        model: 'Product'  
                        });

         const addressId=orderData.address;
        const myAddres= await Address.findOne(
            { userId: userId },
            {
              address: {
                $elemMatch: { _id: addressId }
              }
            }
          );
        const selectedAddress = myAddres.address[0];  
        const formattedDate = new Date(orderData.createdOn).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
         
        res.render('orderDetails',{
             orders:orderData,
             address:selectedAddress

        })
    } catch (error) {
        console.error('error in getting orderDetails page',error);
        res.status(StatusCodes.NOT_FOUND).redirect('/pageNotFound')
    }
}
const cancelOrder=async(req,res)=>{
    try {
        const orderId=req.query.orderId;
         
        const oid=new mongoose.Types.ObjectId(orderId)
        //stock changing
        const order=await Order.findById(oid).populate('orderItems.product')
        for(let item of order.orderItems){
          if(item.productStatus!=='Cancelled'){
            const productId= item.product._id;
            const cancelqantity=item.quantity;
              
            await Product.findByIdAndUpdate(productId,{
              $inc:{quantity:cancelqantity}
            })
            
          } 
            
        }
        
        const updateOrder=await Order.findByIdAndUpdate(oid,
            {status:'Cancelled'},
            {new:true}
        )
        //updating user if payment is wallet
        const totalAmount = order.orderItems.reduce((acc, product) => {
          if (product.productStatus !== 'Cancelled') {
            return acc + (product.price * product.quantity);
          }
          return acc;
        }, 0);

        if(order.payment==='wallet'){
          await User.findByIdAndUpdate(req.session.user._id,{
            $inc:{"wallet.balance":totalAmount},
            $push:{"wallet.transactions":{
              date:new Date(),
              status:'Credited',
              amount:totalAmount
            }
            }
          })
        }
       
        res.redirect(req.get('referer'));
    } catch (error) {
        console.error('error in cancelling the product',error);
        res.status(StatusCodes.NOT_FOUND).redirect('/pageNotFound')
    }
}
const cancelSingleProduct=async(req,res)=>{
  try {
    const{orderId,productId}=req.params;
    const userId=req.session.user;
    const order=await Order.findById(orderId).populate('orderItems.product')
     
    if(!order){
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Order not found' });
    }
    const item = order.orderItems.find(item =>
      item.product._id.toString() === productId 
    );

    if (!item) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Product  not found in order' });
    }

    const cancelAmount = (item.price)*(item.quantity);

    console.log(cancelAmount)
    // Update the product stock
    await Product.findByIdAndUpdate(productId, {
      $inc: { quantity: item.quantity }
    });

    // Update the productStatus to 'Cancelled'
    item.productStatus = 'Cancelled';
    await order.save();
    
     // Check if all products are now cancelled
     const allCancelled = order.orderItems.every(item => item.productStatus === 'Cancelled');

     if (allCancelled) {
         order.status = 'Cancelled';
         await order.save();
     }

    // Refund if payment method is wallet
    if (order.payment === 'wallet') {
      console.log('yes wallet payment')
      console.log('user:',userId)
      await User.findByIdAndUpdate(userId, {
        $inc: { 'wallet.balance': cancelAmount },
        $push: {
          'wallet.transactions': {
            date: new Date(),
            status: 'Credited',
            amount: cancelAmount,
          },
        },
      });
    }

    return res.status(StatusCodes.SUCCESS).json({ message: 'Product cancelled successfully' });

  } catch (error) {
    console.error('error in cancel single product',error)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
  }
}
 
const returnRequest=async(req,res)=>{
    try {
        const {orderId}=req.params;
        const {status,reason}=req.body;
        
        await Order.findByIdAndUpdate(orderId,{status,returnReason:reason},{ runValidators: true })
        res.status(StatusCodes.SUCCESS).json({success:true})


    } catch (error) {
         console.error("Status update error",error)
         res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
    }
}

const getAddress=async(req,res)=>{
    
        try{
            const addressId = req.query.id;
            const addressDoc = await Address.findOne(
              { "address._id": addressId },
              { "address.$": 1 }
            );
        
            if (!addressDoc || !addressDoc.address.length) {
              return res.status(StatusCodes.NOT_FOUND).json({ 
                success: false, 
                error: "Address not found" 
              });
            }
        
            res.status(StatusCodes.SUCCESS).json({ 
              success: true, 
              ...addressDoc.address[0].toObject() 
            });
        } catch (error) {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
              success: false, 
              error: "Server error" 
            });
        }

}
const postAddAddressModal=async(req,res)=>{
    try {
        const { id, ...addressData } = req.body;
        const userId = req.session.user._id; // Make sure session exists
    
        // Validate required fields
        const requiredFields = ['addressType', 'name', 'city', 'landMark', 'state', 'pincode', 'phone', 'altPhone'];
        for (const field of requiredFields) {
          if (!addressData[field]) {
            return res.status(StatusCodes.BAD_REQUEST).json({
              success: false,
              error: `${field} is required`
            });
          }
        }
    
        // Find or create address document
        let addressDoc = await Address.findOne({ userId });
        
        if (!addressDoc) {
          addressDoc = new Address({ 
            userId, 
            address: [addressData] 
          });
        } else {
          addressDoc.address.push(addressData);
        }
    
        await addressDoc.save();
    
        res.status(StatusCodes.CREATED).json({ 
          success: true,
          message: "Address added successfully",
          address: addressDoc.address[addressDoc.address.length - 1]
        });
    
      } catch (error) {
        console.error('Add address error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
          success: false, 
          error: error.message || "Failed to add address" 
        });
      }
}
 
const editAddressModal = async (req, res) => {
    try {
      const { id, ...updateData } = req.body;
  
      const result = await Address.updateOne(
        { "address._id": id },
        { $set: { "address.$": { _id: id, ...updateData } } }
      );
  
      if (result.modifiedCount === 0) {
        return res.status(StatusCodes.NOT_FOUND).json({ 
          success: false, 
          error: "Address not found or no changes made" 
        });
      }
  
      //  Fetch the updated address after updating
      const updatedDoc = await Address.findOne(
        { "address._id": id },
        { "address.$": 1 }
      );
  
      if (!updatedDoc || !updatedDoc.address.length) {
        return res.status(StatusCodes.NOT_FOUND).json({ 
          success: false, 
          error: "Updated address not found" 
        });
      }
  
      const updatedAddress = updatedDoc.address[0];
  
      res.status(StatusCodes.SUCCESS).json({ 
        success: true,
        message: "Address updated successfully",
        address: updatedAddress //  Return to frontend
      });
  
    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(StatusCodes.BAD_REQUEST).json({ 
          success: false, 
          error: errors.join(', ') 
        });
      }
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
        success: false, 
        error: "Failed to update address" 
      });
    }
  };
  
module.exports={
    getCheckoutPage,
    deleteProduct,
    placeOrderCOD,
    placeOrderWallet,
    placeOrderRazorpay,
    verifyPayment,
    placeOrderSuccess,
    orderDetailPage,
    cancelOrder,
    cancelSingleProduct,
    returnRequest,
    getAddress,
    postAddAddressModal,
    editAddressModal,
    applyCoupon
 
}