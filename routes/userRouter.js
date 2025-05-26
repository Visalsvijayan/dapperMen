const express=require('express');
const router=express.Router();
const userController=require("../controllers/user/userController");
const profileController=require('../controllers/user/profileController')
const productController=require('../controllers/user/productController')
const cartController=require('../controllers/user/cartController')
const orderController=require('../controllers/user/orderController')
const wishlistController=require('../controllers/user/wishlistController')
const walletController=require('../controllers/user/walletController')
const contactController=require('../controllers/user/contactController')
const retryPayementController=require('../controllers/user/retryPaymentController')
const passport = require('passport');
const { userAuth } = require('../middlewares/auth');

//home page and shopping page
router.get('/',userController.loadHomepage)
router.get('/shop',productController.loadShoppingPage);
router.get('/filter',productController.filterProduct)
router.get('/filterPrice',userAuth,productController.filterProduct)
//product management
router.get('/productDetails',userAuth,productController.productDetails)


router.get('/pageNotFound',userController.pageNotFound)
router.get('/login',userController.loadLogin)
router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)
router.post("/verify-otp",userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)
router.post('/login',userController.login)
router.get('/logout',userController.logout)
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    req.session.user = req.user; 
    res.redirect('/')
})


//profile management
router.get('/forgotPassword',profileController.getForgotPassword)
router.post('/forgot-Email-Valid',profileController.forgotEmailValid)
router.post('/verify-passForgot-otp',profileController.verifyForgotPassOtp)
router.get('/reset-password',profileController.getResetPassPage)
router.post('/resend-forgot-otp',profileController.resendOtp)
router.post('/reset-password',profileController.postNewPassword)

router.get('/userProfile',userAuth,profileController.userProfile)

router.post('/change-email',userAuth,profileController.changeEmail)
router.post('/verify-emailChange-otp',userAuth,profileController.verifyEmailChangeOtp)
router.get('/new-email-page',userAuth,profileController.getNewEmailPage)
router.post('/update-email',userAuth,profileController.updateEmail)
router.get('/change-password',userAuth,profileController.changePassword)
router.post('/change-password',userAuth,profileController.changePasswordValid)
router.post('/verify-changepassword-otp',userAuth,profileController.verifyChangePasswordOtp)

//address Management
router.get('/addAddress',userAuth,profileController.addAddress)
router.post('/addAddress',userAuth,profileController.postAddAddress);
router.get('/editAddress',userAuth,profileController.editAddress);
router.post('/editAddress',userAuth,profileController.postEditAddress);
router.get('/deleteAddress',userAuth,profileController.deleteAddress)

//cart management
router.get('/cart',userAuth,cartController.getCartPage);
router.post('/add-to-cart',userAuth,cartController.addToCart)
router.post('/changeQuantity',userAuth,cartController.changeQuantity)
router.delete('/remove-Cart-Item',userAuth,cartController.removeCartItem)
//ordermanagement
router.get('/checkout',userAuth,orderController.getCheckoutPage)
router.get('/checkout/validate-stock',orderController.validateStockToCheckout)
  
router.get('/getAddress',userAuth,orderController.getAddress)
router.post('/addAddressModal',userAuth,orderController.postAddAddressModal)
router.post('/editAddressModal',userAuth,orderController.editAddressModal)

router.delete('/delete-product',userAuth,orderController.deleteProduct)
 
router.post('/order/cod',userAuth,orderController.placeOrderCOD)
router.post('/order/wallet',userAuth,orderController.placeOrderWallet)
router.post('/order/razorpay',userAuth,orderController.placeOrderRazorpay)
router.post("/verify-payment",userAuth,orderController.verifyPayment);
router.get('/place-order-success',userAuth,orderController.placeOrderSuccess)
//ordermanagemnt-from-profile session
router.get('/order-Details',userAuth,orderController.orderDetailPage)
router.get('/cancel-Order',userAuth,orderController.cancelOrder)
router.patch('/orders/:orderId/items/:productId/cancel',userAuth,orderController.cancelSingleProduct)
router.patch('/return-Order-Request/:orderId',userAuth,orderController.returnRequest)
//wishlist management
router.post('/wishlist/toggle/:id',userAuth,wishlistController.postWishlist)
router.get('/wishlist-page',userAuth,wishlistController.getWishlistPage)
router.post('/wishlist/addToCart',userAuth,wishlistController.addToCart)
router.delete('/wishlist/remove',userAuth,wishlistController.removeWishlistItem)
//wallet management
router.get('/wallet/addMoney',userAuth,walletController.getAddMoneyPage)
router.post('/wallet/addMoney',userAuth,walletController.addMoney)
//apply coupon
router.post('/coupon/applyCoupon',userAuth,orderController.applyCoupon)
//contact page& about page
router.get('/contact',contactController.getContactPage)
router.post('/contact',contactController.contactMessageSend)
router.get('/about',contactController.aboutPage)
//retryPayment 
router.get('/retryPayment/validate-stock/:orderId',userAuth,retryPayementController.validateStock)
router.patch('/retryPayment/wallet/:orderId',userAuth,retryPayementController.walletPayment)
router.patch('/retryPayment/cod/:orderId',userAuth,retryPayementController.cashOnDelivery)
router.get('/retryPayment/razorpay/:orderId',userAuth,retryPayementController.razorpayPayment)
router.patch('/retryPayment/verify-razorpay/:orderId',userAuth,retryPayementController.verifyRazorpay)
 
module.exports=router;
