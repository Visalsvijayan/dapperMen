const User=require('../models/userSchema')
const Cart=require('../models/cartSchema')
 
const cartCountMiddleware=async(req,res,next)=>{
    try {
        if(req.session.user){
          const userId=req.session.user._id;
          let cartItemCount
          let wishItemCount
          const cart=await Cart.findOne({userId:userId})
          const user= await User.findOne({_id:userId})
          
          cartItemCount=cart ? cart.items.length : 0;
          wishItemCount=user ?user.wishlist.length :0;
           
          res.locals.cartCount=cartItemCount
          res.locals.wishlistCount=wishItemCount
        }
        else{
            res.locals.cartCount=0
            res.locals.wishlistCount=0
        }
    } catch (error) {
        console.error('Error in cartCountMiddleware:', error);
        res.locals.cartCount = 0;
        res.locals.wishlistCount=0;
        
    }

    next();
}

module.exports=cartCountMiddleware