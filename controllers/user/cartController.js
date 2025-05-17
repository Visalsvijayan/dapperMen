const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart=require('../../models/cartSchema')
const mongoose=require('mongoose'); 
const StatusCodes = require("../../config/statusCode");

 
const getCartPage = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const oid = new mongoose.Types.ObjectId(userId);
        const page=parseInt(req.query.page)||1;
        const limit=3;
        
        const user = await User.findById(userId).populate('cart');
  
        const cart = await Cart.findOne({ userId: oid }).populate('items.productId');
         
        if (!cart) {
            return res.render('cart', {
                user,
                quantity: 0,
                data: [],
                grandTotal: 0,
                currentPage:1,
                totalPages:1
               
            });
        }

        // Prepare data for template
        const data = cart.items.map(item => ({
            quantity: item.quantity,
            productDetails: item.productId // Already populated
        }));

        // Calculate totals
        let quantity = 0;
        let grandTotal = 0;
        
        data.forEach(item => {
            quantity += item.quantity;
            grandTotal += item.productDetails.salePrice * item.quantity;
        });
        //pagination things
        const sortedItems = [...cart.items].sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        const totalItems=sortedItems.length;
        const totalPages=Math.ceil(totalItems/limit)
        const startIndex=(page-1)*limit;
        const endIndex=startIndex+limit;
        const paginatedItems=sortedItems.slice(startIndex,endIndex)
        req.session.grandTotal = grandTotal;

        res.render('cart', {
            user,
            quantity,
            data: paginatedItems.map(item => ({  
                quantity: item.quantity,
                productDetails: item.productId
            })),
            grandTotal,
            currentPage:page,
            totalPages,
             
        });
        
    } catch (error) {
        console.error('Error in getting cart page:', error);
        res.status(StatusCodes.NOT_FOUND).redirect('/pageNotFound');
    }
};

 
const addToCart = async (req, res) => {
    try {
        const { id } = req.body;
        const quantity = parseInt(req.body.quantity) || 1;
        const userId = req.session.user._id;
        const product = await Product.findById(id);
        if (!product) return res.status(StatusCodes.NOT_FOUND).json({ error: "Product not found" });
        if (product.quantity <= 0) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Out of stock" });
        const user = await User.findById(userId).populate('cart');
        let cart = await Cart.findOne({ userId });

        // Creating cart if doesn't exist
        if (!cart) {
            cart = new Cart({
                userId,
                items: [{
                    productId: id,
                    quantity: quantity,
                    price: product.salePrice,
                    totalPrice: product.salePrice,
                    status: 'active'
                }]
            });
            await cart.save();
            
            // Link cart to user
            if (!user.cart) user.cart = [];
            user.cart.push(cart._id);
            await user.save();
        } 
        else {
            const maxQuantity=5;
            const existingItem = cart.items.find(item => 
                item.productId.toString() === id.toString()
            );

            if (existingItem) {
                
                
                const newQuantity = (existingItem.quantity) + quantity;
                console.log('new q=',newQuantity)

                if (newQuantity > product.quantity) {
                    return res.status(StatusCodes.BAD_REQUEST).json({ success: false,title:"Stock error", status: "Out of stock" });
                }
                if (newQuantity > maxQuantity) {
                    return res.status(StatusCodes.BAD_REQUEST).json({ success: false, title:"Limit error",status: "Only 5 quantity per item can be added" });
                }

                existingItem.quantity =newQuantity;
                existingItem.totalPrice = existingItem.quantity * existingItem.price;
            } else {
                // Add new item
                cart.items.push({
                    productId: id,
                    quantity: quantity,
                    price: product.salePrice,
                    totalPrice: product.salePrice,
                    status: 'active'
                });
            }

            await cart.save();
        }

        return res.json({ 
            success: true, 
            cart: await Cart.findById(cart._id).populate('items.productId')
        });

    } catch (error) {
        console.error('Error in addToCart:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Server error" });
    }
};
 
const changeQuantity = async (req, res) => {
    try {
        const { productId, quantity, count } = req.body;
        const userId = req.session.user._id;

        // Update cart item quantity
        const cart = await Cart.findOne({ userId });
        const itemIndex = cart.items.findIndex(item => item.productId.equals(productId));
        
        if (itemIndex > -1) {
            cart.items[itemIndex].quantity = parseInt(quantity);
            cart.items[itemIndex].totalPrice = cart.items[itemIndex].price * parseInt(quantity);
        }
        
        // Recalculate grand total
        let grandTotal = 0;
        cart.items.forEach(item => {
            grandTotal += item.totalPrice;
        });
       
        await cart.save();

        // Send response with new grand total
        res.status(StatusCodes.SUCCESS).json({
            success: true,
            quantity: quantity,
            grandTotal: grandTotal.toFixed(2)
        });

    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Error updating quantity'
        });
    }

}

const removeCartItem=async(req,res)=>{
    try {
        const productId=req.query.id;
        const userId=await req.session.user._id;
        
        const updateCart=await Cart.findOneAndUpdate(
            {userId:userId},
            {$pull:{items:{productId:productId}}},
            {new:true}
        ).populate('items.productId');
        if(!updateCart){
            return res.status(StatusCodes.NOT_FOUND).json({success:false,message:'cart not found'})

        }
        res.status(StatusCodes.SUCCESS).json({
            success:true,
            message:'Item removed from cart',
            cart:updateCart
        })

    } catch (error) {
        console.error('error in removing item from cart:',error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({success:false,message:'server error'});
        
    }
}
module.exports={
    getCartPage,
    addToCart,
    changeQuantity,
    removeCartItem
}