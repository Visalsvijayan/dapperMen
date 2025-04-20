const mongoose=require('mongoose');
const couponSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    startOn:{
        type:Date,
        required:true
    },
    expireOn:{
        type:Date,
        required:true

    },
    discountType:{
        type:String,
        enum:['Fixed','Percentage'],
        default:'percentage',
        required:true
    },
    offer:{
        type:Number,
        required:true
    },
    minimumPrice:{
        type:Number,
        required:true
    },
    maxDiscount:{
        type:Number,
        default:null
    },
    
    isActive:{
        type:Boolean,
        default:true
    },
    userId:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    }]
})

const Coupon=mongoose.model("Coupon",couponSchema)
module.exports=Coupon;