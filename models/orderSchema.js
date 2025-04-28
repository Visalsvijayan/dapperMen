const mongoose=require('mongoose');
const {v4:uuidv4}=require('uuid');
const { Schema } = mongoose;
const OrderSchema=new mongoose.Schema({
    orderId:{
        type:String,
        default:()=>uuidv4(),
        unique:true
    },
    orderItems:[{
        product:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        quantity:{
            type:Number,
            required:true
        },
        price:{
            type:Number,
            default:0
        },
        productOfferAmount:{
            type:Number,
            default:0
        }
    }],

    totalPrice:{
        type:Number,
        required:true
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
        required:true
    },
    address:{
        type:Schema.Types.ObjectId,
        ref:"Address",
        required:true

    },
    invoiceDate:{
        type:Date
    },
    status:{
        type:String,
        required:true,
        enum:['Pending','Processing','Shipped','Delivered','Reject return product','Cancelled']
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    couponApplied:{
        type:Boolean,
        default:false
    },
    payment:{
        type:String,
        required:true
    },
    paymentStatus:{
        type:String
    },
    razorpay: {
        order_id: { type: String },
        payment_id: { type: String },
        signature: { type: String }
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',  
        required: true
    },
    returnReason:{
        type:String
    }

})

const Order=mongoose.model("Order",OrderSchema)
module.exports=Order;