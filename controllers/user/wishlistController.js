const User=require('../../models/userSchema');
const Product=require('../../models/productSchema')
const Cart=require('../../models/cartSchema')
const mongoose=require('mongoose');
const { userAuth } = require('../../middlewares/auth');
const postWishlist=async(req,res)=>{
    try {
       
        const productId=req.params.id;
        const userId=req.session.user;
         const user=await User.findById(userId)
         const index = user.wishlist.findIndex(id => id.toString() === productId);
        let status;
        if(index===-1){
            console.log('hi')
            user.wishlist.push(new mongoose.Types.ObjectId(productId))
            status='added'
        }
        else{
            user.wishlist.splice(index,1)
            status='removed'
        }
        await user.save();
        res.json({status})
    } catch (error) {
        res.status(500).json({status:'error'})
    }
}

const getWishlistPage=async(req,res)=>{
    try {
        const userId = req.session.user;
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 3;  
        const skip = (page - 1) * limit;
    
        
        const user = await User.findById(userId).populate('wishlist');
    
         
        let filteredWishlist = user.wishlist;
        const regex = new RegExp(search, 'i'); 
        if (search) {
            

            filteredWishlist = user.wishlist.filter(product =>
              regex.test(product.productName)
            ); 
          
        }
        const totalProducts = filteredWishlist.length;
        const totalPages = Math.ceil(totalProducts / limit);
        const paginatedWishlist = filteredWishlist.slice(skip, skip + limit);
        res.render('wishlist', {
          wishlist: paginatedWishlist,
          currentPage: page,
          totalPages,
          search,
        });
    } catch (error) {
        console.error('error in wishlist listing',error)
        res.status(500).redirect('/pageNotFound')
    }
}
const addToCart=async(req,res)=>{
    try {
        const userId=req.session.user._id;
        const productId=req.body.productId;
        const product=await Product.findById(productId)
        let cart=await Cart.findOne({userId:userId})
        if(!cart){
            cart=new Cart({
                userId,
                items:[{
                    productId,
                    quantity:1,
                    price:product.salePrice,
                    totalPrice:product.salePrice,
                    status:'active'
                }]
            })
             
        }
        else{
             
            const existingItem = cart.items.find(item => item.productId.toString() === productId);
            if(existingItem){
                existingItem.quantity+=1;
                existingItem.totalPrice +=existingItem.price;

            }
            else{
                cart.items.push({
                    productId,
                    quantity:1,
                    price:product.salePrice,
                    totalPrice:product.salePrice
                })
            }

        }
        await cart.save();
        //remove item from wishlist
        await User.findByIdAndUpdate(userId,{
            $pull:{wishlist:productId}
        })
        res.json({success:true,msg:'added item to cart and removed from wishlist'})
    } catch (error) {
        console.error('cart adding error',error)
        res.status(500).json({msg:"Internal server error"})

    }
}


const removeWishlistItem=async(req,res)=>{
    try {
        const userId=req.session.user._id;
        const productId=req.body.productId
        await User.findByIdAndUpdate(userId,{
            $pull:{wishlist:productId}},
            {new:true}
        )
        res.json({success:true})
    } catch (error) {
        console.error('error in removing from wishlist',error)
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

module.exports={
    postWishlist,
    getWishlistPage,
    addToCart,
    removeWishlistItem
}