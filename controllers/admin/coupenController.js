const Coupon=require('../../models/couponSchema');
const User = require('../../models/userSchema');
const getCoupenPage=async(req,res)=>{
    try {
        const coupon=await Coupon.find().sort({createdOn:-1})
        const perPage=5;
        const page=parseInt(req.query.page) ||1
        const totalPages=Math.ceil(coupon.length/perPage);
        const pagination = coupon.slice((page - 1) * perPage,page * perPage);


        await Coupon.updateMany(
            { expireOn: { $lt: new Date() }, isActive: true },
            { $set: { isActive: false } }
        );
        
        res.render('coupenManagement',{
            coupons:pagination,
            totalPages,
            currentPage:page,
            
        })
    } catch (error) {
        console.error('error in coupon display page',error)
        res.status(500).redirect('/admin/pageerror')
        
    }
}

// const postCouponDetails=async(req,res)=>{
//     try {
        
//         const data=req.body
//         console.log('data here:',data)
//         const couponName=data.code;
//         const newCoupon=new Coupon({
//             name:data.code,
//             createdOn:new Date(),
//             startOn:data.start,
//             expireOn:data.expiry,
//             discountType:data.type,
//             offer:data.value,
//             minimumPrice:data.minimumPurchase,
//             maxDiscount:data.maxDiscount,
//             isActive:true
            
//         })
//         if(data.couponId){
//             await Coupon.findOneAndUpdate()

//         }
//         else{
//             const isExist=await Coupon.findOne({name:couponName})
//             if(isExist){
//                 return res.json({success:false,msg:"coupon with same name already exist"})
//             }
            
            
            
//             await newCoupon.save();
    
//             res.json({success:true})

//         }
       
//     } catch (error) {
//         console.error('error in posting coupen',error)
//         res.status(500).json({success:false})
//     }
// }

const postCouponDetails = async (req, res) => {
    try {
        const data = req.body;
        const couponName = data.code;
         

        // If couponId exists, update the existing coupon
        if (data.couponId) {
            const updatedCoupon = await Coupon.findByIdAndUpdate(
                data.couponId,
                {
                    name: data.code,
                    startOn: new Date(data.start),
                    expireOn: new Date(data.expiry),
                    discountType: data.type,
                    offer: data.value,
                    minimumPrice: data.minimumPurchase,
                    maxDiscount: data.maxDiscount,
                     
                },
                { new: true }  
            );

            if (!updatedCoupon) {
                return res.json({ success: false, msg: "Coupon not found" });
            }

            return res.json({ success: true, msg:"coupon updated successfully" });
        }
        // If no couponId, create new coupon
        else {
            
            const isExist = await Coupon.findOne({ name: couponName });
            if (isExist) {
                return res.json({ success: false, msg: "Coupon with same name already exists" });
            }

            const newCoupon = new Coupon({
                name: data.code,
                createdOn: new Date(),
                startOn: new Date(data.start),
                expireOn: new Date(data.expiry),
                discountType: data.type,
                offer: data.value,
                minimumPrice: data.minimumPurchase,
                maxDiscount: data.maxDiscount,
                isActive: true,
            
            });

            await newCoupon.save();
            return res.json({ success: true,msg:"coupon added successfully" });
        }
    } catch (error) {
        console.error('Error in saving coupon:', error);
        res.status(500).json({ success: false, msg: "Internal server error" });
    }
};



const getEditCoupon=async(req,res)=>{
    try {
        console.log('hieeee')
        const couponId = req.params.id;
        const coupon = await Coupon.findById(couponId);
         
        if (!coupon) {
          return res.status(404).json({ error: 'Coupon not found' });
        }
         
        res.json(coupon);
      } catch (error) {
        res.status(500).json({ error: 'Server error' });
      }
}

const deleteCoupon=async(req,res)=>{
    console.log('delete')
    try {
        const couponId=req.body.couponId;
        
        await Coupon.findByIdAndDelete(couponId)
        res.json({success:true}); 
    } catch (error) {
        console.error('error in delete coupon',error)
        res.status(500).json({success:false})
    }
}


//this is to export to the userController to genreate referal coupon

 const generateReferralCoupon = async (referrerId, discount = 50) => {
    const code = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const coupon = new Coupon({
      name:code,
      createdOn:new Date(),
      startOn:new Date(),

      discountType:'Fixed',
      offer:discount,
      expireOn: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // valid for 15 days
      userId: referrerId,
      isActive: true,
      isReferrCoupon:true
    });
  
    await coupon.save();
    await User.updateOne({_id:referrerId},
        {$inc:{referrCouponCount:1}})
    };
module.exports={
    getCoupenPage,
    postCouponDetails,
    getEditCoupon,
    deleteCoupon,
    generateReferralCoupon
}