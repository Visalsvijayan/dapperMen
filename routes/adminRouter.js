const express=require('express');
const nocache=require('nocache')
const router=express.Router();
const adminContoller=require('../controllers/admin/adminController')
const customerController=require('../controllers/admin/customerController')
const categoryController=require('../controllers/admin/categoryController')
const productController=require('../controllers/admin/productController')
const brandController=require('../controllers/admin/brandController')
const orderController=require('../controllers/admin/orderController')
const coupenController=require('../controllers/admin/coupenController')
const salesController=require('../controllers/admin/salesController')
const {userAuth,adminAuth}=require('../middlewares/auth');
// const multer=require('multer');
// const storage=require("../helpers/multer");
// const uploads=multer({storage:storage});

const { uploadProductImages, uploadBrandImage } = require("../helpers/multer");
 
  
router.get('/login',adminContoller.loadLogin)
router.post('/login',adminContoller.login)
router.get('/',adminAuth,adminContoller.loadDashboard)
router.get('/logout',adminAuth,adminContoller.logout)
router.get('/pageerror',adminAuth,adminContoller.pageerror)
//costumer management
router.get('/users',adminAuth,customerController.customerInfo)
router.get('/blockCustomer',adminAuth,customerController.customerBlocked);
router.get('/unblockCustomer',adminAuth,customerController.customerUnblocked);
//category management
router.get('/category',adminAuth,categoryController.categoryInfo);
router.post('/addCategory',adminAuth,categoryController.addCategory)
router.post("/addOffer",adminAuth,categoryController.addOffer)
router.post('/removeOffer',adminAuth,categoryController.removeOffer);
router.get('/listCategory',adminAuth,categoryController.getlistCategory)
router.get('/unlistCategory',adminAuth,categoryController.getUnlistCategory)
router.get('/editCategory',adminAuth,categoryController.geteditCategory)
router.post("/editCategory/:id",adminAuth,categoryController.editCategory)
router.get("/dashboard",adminAuth,adminContoller.dashboard)
//product management
router.get('/addProducts',adminAuth,productController.getProductAddPage)
router.post("/addProducts", adminAuth, uploadProductImages.array("images", 4), productController.addProducts);
router.get('/products',adminAuth,productController.getAllProducts)
router.post('/addProductOffer',adminAuth,productController.addProductOffer)
router.post('/removeProductOffer',adminAuth,productController.removeProductOffer)
router.get('/blockProduct',adminAuth,productController.blockProduct)
router.get('/unblockProduct',adminAuth,productController.unblockProduct)
router.get('/editProduct',adminAuth,productController.getEditProduct)
router.post('/editProduct/:id',adminAuth,uploadProductImages.array('images',4),productController.editProduct);

//brand management
router.get("/brands",adminAuth,brandController.getBrandPage);
// router.post('/addBrand',adminAuth,uploads.single("image"),brandController.addBrand)
router.post("/addBrand", adminAuth, uploadBrandImage.single("image"), brandController.addBrand);
router.get('/blockBrand',adminAuth,brandController.blockBrand)
router.get('/unblockBrand',adminAuth,brandController.unblockBrand)
router.get('/deleteBrand',adminAuth,brandController.deleteBrand)

//order management
router.get('/orders',adminAuth,orderController.getOrdersPage)
router.get('/orderDetails',adminAuth,orderController.orderDetails)
router.patch('/update-Order-Status/:orderId',adminAuth,orderController.UpdateOrderStatus)
router.patch('/approve-return/:orderId',adminAuth,orderController.approveReturnOrder)
router.patch('/reject-return/:orderId',adminAuth,orderController.rejectReturnOrder)

//stock management
router.get('/stocks',adminAuth,productController.getStockPage)
router.patch('/update-quantity/:id',adminAuth,productController.updateQuantity)
//coupen management
router.get('/coupons',adminAuth,coupenController.getCoupenPage)
router.post('/coupons/addCoupon',adminAuth,coupenController.postCouponDetails)
// router.put('/coupons/update/:id',adminAuth,coupenController.editCoupon)
 router.get('/coupons/editCoupon/:id',adminAuth,coupenController.getEditCoupon)
 router.post('/coupon/delete',adminAuth,coupenController.deleteCoupon)

 //salesManagement
 router.get('/sales',adminAuth,salesController. getSelesReportPage)
 router.post('/sales-dashboard-data',adminAuth,salesController.salesDashboardData)
 router.post('/salesTable',adminAuth,salesController.salesTableData)
module.exports=router;
