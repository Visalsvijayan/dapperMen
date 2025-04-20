const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");
 
const mongoose=require('mongoose')
const Product=require('../../models/productSchema')
const Cart=require('../../models/cartSchema')
const Order=require('../../models/OrderSchema')
const { v4: uuidv4 } = require('uuid');
const razorpayInstance=require('../../config/razorpay')
const crypto = require('crypto');


const getCheckoutPage=async(req,res)=>{
    try {
         
        const user=req.session.user._id;
        const findUser=await User.findOne({_id:user})
        const addressData=await Address.findOne({userId:user})
         
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
         
        if(data.length>0 && data[0].allItem && data[0].allItem.length>0){
            

            res.render('checkoutPage',{
                data,
                user:findUser,
                isCart:true,
                userAddress:addressData

            })
        }
        else{
            res.render('checkoutPage', {
              data: [],
              user: findUser,
              isCart: false,  
              userAddress: addressData
          });

        }
        

        
        
    } catch (error) {
        console.error('error in checkout',error)
        res.redirect('/pageNotFound')
        
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
        res.json({
            success:true,
            message:'Item removed from cart',
            cart:updateCart
        })

    } catch (error) {
        console.error('error in removing item from cart:',error);
        res.status(500).json({success:false,message:'server error'});
        
    }
}


// const postPlaceOrder = async (req, res) => {
//     try {
         
//         const { totalPrice, createdOn, date, addressId, payment, discount} = req.body;
//         const userId = req.session.user._id;
//         let walletAmount=req.body.walletAmount
//         // Find user and populate cart details
//         const userDetails = await User.findById(userId)
//             .populate({
//                 path: "cart",
//                 populate: {
//                     path: "items.productId",
//                     model: "Product"
//                 }
//             })
//             .lean();

//         if (!userDetails) {
//             return res.json({ success: false, message: "User not found" });
//         }

         
//         if (!userDetails.cart.length) {
//             return res.json({ success: false, message: "Cart is empty" });
//         }

         
//         const productIds = userDetails.cart[0].items.map(item => item.productId._id);
        
//         // Find address
//         const findAddress = await Address.findOne({ userId, "address._id": addressId });
//         if (!findAddress) {
//             return res.json({ success: false, message: "Address not found" });
//         }

//         // Find products in the cart
//         const findProducts = await Product.find({ _id: { $in: productIds } });
//         if (findProducts.length !== productIds.length) {
//             return res.json({ success: false, message: "Some products are not found" });
//         }
 
//         // Preparing order items
//         const orderedProducts = findProducts.map(item => ({
//             _id: item._id,
//             price: item.salePrice,
//             name: item.productName,
//             image: item.productImage[0],
//             productStatus: "Confirmed",
//             quantity: userDetails.cart[0].items.find(cartItem => cartItem.productId._id.toString() === item._id.toString()).quantity,
//         }));

//         const finalAmount = totalPrice - (discount || 0);
         

//         // Create order
//         const newOrder = new Order({
//             orderId: uuidv4(),
//             userId: userId,
//             orderItems: orderedProducts.map(product => ({
//                 product: product._id,
//                 quantity: product.quantity,
//                 price: product.price
//             })),
//             totalPrice,
//             discount: discount || 0,
//             finalAmount,
//             address: findAddress.address.find(a => a._id.toString() === addressId.toString()), // Fetch the correct address
//             status: "Pending",
//             createdOn: new Date(),
//             couponApplied: discount > 0,
//             payment,
//             userId
             
//         });
//         //reduce stock
//         for(let item of newOrder.orderItems ){
//             await Product.findByIdAndUpdate(item.product,{
//                 $inc:{quantity:-item.quantity}
//             })
//         }

//    // Redirect based on payment method
//         if (newOrder.payment === "cod") {
//             const orderDone = await newOrder.save();
//             await User.findByIdAndUpdate(userId, {
//                 $push: { orderHistory: newOrder._id }
//             });
    
//             // Clear the user's cart
//             await Cart.updateOne({userId:userId }, { $set: { items: [] } });
//             return res.json({
//                 success: true,
//                 redirect: `/place-order-success?orderId=${newOrder.orderId}`,
//                 orderId: orderDone._id
//             });
//         }
//          //if payment is wallet
//         if(newOrder.payment==='wallet'){
//              walletAmount=parseInt(walletAmount)
//             if(walletAmount<finalAmount){
//                 return res.json({
//                   success: false,
//                   message: "Insufficient wallet balance"
//                 });
//             }
//             const orderDone=await newOrder.save();  //order saved
//             await User.findByIdAndUpdate(userId,{      //updating user
                    
//               $inc:{"wallet.balance":-finalAmount},
//               $push:{orderHistory:orderDone._id,
//                   "wallet.transactions":{
//                 amount:finalAmount,
//                 date:new Date,
//                 status:'Debited',
//               }}
//             })
//             await Cart.updateOne({userId:userId }, { $set: { items: [] } });
//             return res.json({
//                 success: true,
//                 redirect: `/place-order-success?orderId=${newOrder.orderId}`,
//                 orderId: orderDone._id
//             });

//         }
//         if(newOrder.payment==='razorpay'){

//         }
         
//     } catch (error) {
//         console.error("Error in placing order:", error);
//         res.redirect("/pageNotFound");
//     }
// };
 

async function prepareOrderData(req){
  const { totalPrice, createdOn, date, addressId, payment, discount} = req.body;
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
      return res.json({ success: false, message: "User not found" });
  }

   
  if (!userDetails.cart.length) {
      return res.json({ success: false, message: "Cart is empty" });
  }

   
  const productIds = userDetails.cart[0].items.map(item => item.productId._id);
  
  // Find address
  const findAddress = await Address.findOne({ userId, "address._id": addressId });
  if (!findAddress) {
      return res.json({ success: false, message: "Address not found" });
  }

  // Find products in the cart
  const findProducts = await Product.find({ _id: { $in: productIds } });
  if (findProducts.length !== productIds.length) {
      return res.json({ success: false, message: "Some products are not found" });
  }

  // Preparing order items
  const orderedProducts = findProducts.map(item => ({
      _id: item._id,
      price: item.salePrice,
      name: item.productName,
      image: item.productImage[0],
      productStatus: "Confirmed",
      quantity: userDetails.cart[0].items.find(cartItem => cartItem.productId._id.toString() === item._id.toString()).quantity,
  }));

  const finalAmount = totalPrice - (discount || 0);
   

  // Create order
  const newOrder = new Order({
      orderId: uuidv4(),
      userId: userId,
      orderItems: orderedProducts.map(product => ({
          product: product._id,
          quantity: product.quantity,
          price: product.price
      })),
      totalPrice,
      discount: discount || 0,
      finalAmount,
      address: findAddress.address.find(a => a._id.toString() === addressId.toString()), // Fetch the correct address
      status: "Pending",
      createdOn: new Date(),
      couponApplied: discount > 0,
      payment,
      userId
       
  });
  //reduce stock
  for(let item of newOrder.orderItems ){
      await Product.findByIdAndUpdate(item.product,{
          $inc:{quantity:-item.quantity}
      })
  }

  return {newOrder,finalAmount,userId,walletAmount}
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
    return res.json({
        success: true,
        redirect: `/place-order-success?orderId=${newOrder.orderId}`,
        orderId: orderDone._id
    });
    
  } catch (error) {
    console.error("Error in placing order:", error);
    res.status(500).json({success:false})
    
  }
  
}

const placeOrderWallet=async(req,res)=>{
  try {
    const {newOrder,finalAmount,userId,walletAmount}=await prepareOrderData(req)
    if(walletAmount<finalAmount){
        return res.json({
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
    return res.json({
        success: true,
        redirect: `/place-order-success?orderId=${newOrder.orderId}`,
        orderId: orderDone._id
    });
             
  } catch (error) {
    console.error("Error in placing order:", error);
    res.status(500).json({success:false})
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
    
    return res.json({
      success:true,
      key_id:process.env.RAZORPAY_KEY_ID,
      amount:options.amount,
      orderData:newOrder,
      razorpayOrder
    })
    
  } catch (error) {
    
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
    }));
    if (findProducts.length !== productIds.length) {
        return res.json({ success: false, message: "Some products are not found" });
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
          price: product.price
        })),
        userId:req.session.user._id,
        razorpay: {
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
          signature: razorpay_signature
        }
      });

      const savedOrder = await newOrder.save();
      await User.findByIdAndUpdate(savedOrder.userId, {
        $push: { orderHistory: savedOrder._id }
      });

      // Clear cart
      await Cart.updateOne({ userId: savedOrder.userId }, { $set: { items: [] } });

      return res.json({ success: true, orderId: savedOrder.orderId });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error("Error in verifyPayment:", error);
    res.json({ success: false });
  }
};


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
            

        res.render('orderPlaced',{orid:orderId,address:selectedAddress,payment:payment,totalPrice:totalPrice,date:formattedDate})
    } catch (error) {
        console.error('error loading order placed succes page',error)
        res.redirect('/pageNotFound');
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
         
         
        res.render('orderDetails',{
             orders:orderData

        })
    } catch (error) {
        console.error('error in getting orderDetails page',error);
        res.redirect('/pageNotFound')
    }
}
const cancelOrder=async(req,res)=>{
    try {
        const orderId=req.query.orderId;
         
        const oid=new mongoose.Types.ObjectId(orderId)
        //stock changing
        const order=await Order.findById(oid).populate('orderItems.product')
        for(let item of order.orderItems){
           const productId= item.product._id;
           const cancelqantity=item.quantity;
            
           await Product.findByIdAndUpdate(productId,{
            $inc:{quantity:cancelqantity}
           })
            
        }
        
        const updateOrder=await Order.findByIdAndUpdate(oid,
            {status:'Cancelled'},
            {new:true}
        )
        //updating user if payment is wallet
        const totalAmount=order.finalAmount;
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
        res.redirect('/pageNotFound')
    }
}

const returnRequest=async(req,res)=>{
    try {
        const {orderId}=req.params;
        const {status,reason}=req.body;
        
        await Order.findByIdAndUpdate(orderId,{status,returnReason:reason})
        res.json({success:true})


    } catch (error) {

         console.error("Status update error",error)
         res.status(500).json({ success: false, message: "Internal server error" });
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
              return res.status(404).json({ 
                success: false, 
                error: "Address not found" 
              });
            }
        
            res.json({ 
              success: true, 
              ...addressDoc.address[0].toObject() 
            });
        } catch (error) {
            res.status(500).json({ 
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
            return res.status(400).json({
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
    
        res.json({ 
          success: true,
          message: "Address added successfully",
          address: addressDoc.address[addressDoc.address.length - 1]
        });
    
      } catch (error) {
        console.error('Add address error:', error);
        res.status(500).json({ 
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
        return res.status(404).json({ 
          success: false, 
          error: "Address not found or no changes made" 
        });
      }
  
      // 🔁 Fetch the updated address after updating
      const updatedDoc = await Address.findOne(
        { "address._id": id },
        { "address.$": 1 }
      );
  
      if (!updatedDoc || !updatedDoc.address.length) {
        return res.status(404).json({ 
          success: false, 
          error: "Updated address not found" 
        });
      }
  
      const updatedAddress = updatedDoc.address[0];
  
      res.json({ 
        success: true,
        message: "Address updated successfully",
        address: updatedAddress // ✅ Return to frontend
      });
  
    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ 
          success: false, 
          error: errors.join(', ') 
        });
      }
      res.status(500).json({ 
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
    returnRequest,
    getAddress,
    postAddAddressModal,
    editAddressModal
 
}