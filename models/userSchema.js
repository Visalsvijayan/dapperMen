const mongoose=require('mongoose');
const {Schema}=mongoose;
const  userSchema=new Schema({
    name:{
        type:String,
        // required:true
    },
    email:{
        type:String,
        // required:true,
        unique:true
    },
    phone:{
        type:String,
        unique:true
     
    },
    googleId:{
        type:String,
        unique:true,
        sparse:true
         
    },
    password:{
        type:String,
         
     
    },
    isBlocked:{
        type:Boolean, 
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    cart:[{
        type:Schema.Types.ObjectId,
        ref:"Cart"
    }],
     
    wishlist:[{
        type:Schema.Types.ObjectId,
        ref:"Product"
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:"Order"
    }],
    createdOn:{
        type:Date,
        default:Date.now
    },
    referralCode:{
        type:String,
        unique:true,
        required:true
    
    },
    referredUsers:[{
        type:Schema.Types.ObjectId,
        ref:"User"
    }],
    referredBy:{
        type:Schema.Types.ObjectId,
        ref:'User',
        default:null

    },
    
    searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:"Category",
        },
        brand:{
            type:String
        },
        searchOn:{
            type:Date, 
            default:Date.now
        }

    }],
    referrCouponCount:{
        type:Number,
        default:0

    },

    wallet: {
        balance: {
          type: Number,
          default: 0
        },
        transactions: [
          {
            date: {
              type: Date,
              default: Date.now
            },
            status: {
              type: String,
              enum: ['Credited', 'Debited'],  
              required: true
            },
            amount: {
              type: Number,
              required: true
            }
          }
        ]
    }
})



const User=mongoose.model("User",userSchema);
module.exports=User;