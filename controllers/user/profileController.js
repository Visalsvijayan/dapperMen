const User=require('../../models/userSchema');
const Address=require('../../models/addressSchema')
const Order=require('../../models/orderSchema')
const nodemailer=require('nodemailer');
const bcrypt=require('bcrypt');
const env=require('dotenv').config();
const session=require('express-session');
const mongoose=require('mongoose')
const statusCodes=require('../../config/statusCode')

function generateOtp(){
    const digits="1234567890";
    let otp=""
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)]
    }
    return otp;

}
async function sendVerificationEmail(email,otp){
    try {
        const transporter=nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,
       
            }

        })
        const mailOptions={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"your OTP for password reset",
            text:`Your OTP is ${otp}`,
            html:`<h4>Your OTP:${otp}</h4>`
        }
        const info=await transporter.sendMail(mailOptions);
        console.log("Email sent:" ,info.messageId)
        return true;
    } catch (error) {
        console.log('Error sending email',error)
        return false;
        
    }

}




 
const getForgotPassword=async(req,res)=>{
    try {
        res.render('forgotPassword')
    } catch (error) {

        res.status(statusCodes.NOT_FOUND).redirect('/pageNotFound')
    }

    
}
const forgotEmailValid=async(req,res)=>{
    try {
        const {email}=req.body;
        const findUser=await User.findOne({email:email})
        if(findUser){
            const otp=generateOtp();
            const emailSent=await sendVerificationEmail(email,otp)
            if(emailSent){
                req.session.userOtp=otp;
                req.session.email=email;
                res.render("forgotPassOtp")
                console.log('OTP :',otp)

            }
            else{
                 res.json({success:false,message:"failed to send OTP.please try again"})
            }
        }else{
            res.render('forgotPassword',{msg:"user with this email does not exist"});
        }
    
    } catch (error) {
        res.redirect('/pageNotFound')
    }

}



const verifyForgotPassOtp=async(req,res)=>{
    try {
        const enterdOtp=req.body.otp;
        if(enterdOtp===req.session.userOtp){
            res.json({success:true,redirectUrl:"/reset-password"})
    
        }else{
            res.json({success:false,message:"OTP not matching"})
        }
        
    } catch (error) {
        res.status(500).json({success:fasle,message:"An error occured.Please try again"})
        
    }
    
}

const getResetPassPage=async(req,res)=>{
    try {
        res.render('reset-password')
    } catch (error) {
        
    }
}

const resendOtp=async(req,res)=>{
  
    try{
       
        const otp=generateOtp();
        
        req.session.userOtp=otp;
        const email=req.session.email;
      
        const emailSent=await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log('Resend OTP: ',otp);
            res.status(200).json({success:true,msg:"Resend OTP successful"})
        }
    }catch (error){
        console.error("Error in resending otp",error)
        res.status(500).json({success:false,msg:'Internal server error'})
        
    }
}

const postNewPassword=async(req,res)=>{
    try {
        const {newPass1,newPass2}=req.body
        const email=req.session.email;
        if(newPass1===newPass2){
            const passwordHash=await securePassword(newPass1)
            await User.updateOne({email:email},{$set:{password:passwordHash}});

            
            res.redirect('/login')

        }
        else{
            res.render('reset-password',{msg:"password do not match"})
        }
    } catch (error) {
        res.redirect('/pageNotFound')
        
    }
}

const securePassword=async(password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10)
        return passwordHash;
    } catch (error) {
        
    }
}


const userProfile = async (req, res) => {
    try {
      const userId = req.session.user;
      const userData = await User.findById(userId);
      const addressData = await Address.findOne({ userId });
      const ORDERS_PER_PAGE = 2;
      const page = parseInt(req.query.page) || 1;
      const walltPage=parseInt(req.query.walltPage) || 1;
      const perPage = 4;
      const search = req.query.search || '';
  
      const userWithOrders = await User.findById(userId)
        .select('orderHistory')
        .populate({
          path: 'orderHistory',
          populate: {
            path: 'orderItems.product',
            model: 'Product',
          },
        })
        .lean();
     
      let filteredOrders = userWithOrders.orderHistory;
  
      if (search) {
        const searchLower = search.toLowerCase();
        filteredOrders = filteredOrders.filter(order =>
          order.orderId.toLowerCase().includes(searchLower) ||
          order.status.toLowerCase().includes(searchLower)
        );
      }
  
      const totalOrders = filteredOrders.length;
      const totalPages = Math.ceil(totalOrders / perPage);
      const reversedOrders = filteredOrders.reverse(); // reverse the array
      const paginatedOrders = reversedOrders.slice((page - 1) * perPage, page * perPage);
   
      const formattedOrders = paginatedOrders.map(order => ({
        oid: order._id,
        orderId: order.orderId,
        date: order.createdOn,
        status: order.status,
        total: order.finalAmount,
        discount: order.discount,
        payment: order.payment,
        items: order.orderItems.map(item => ({
          product: {
            ...item.product,
            mainImage: item.product.productImage?.[0] || '/images/default-product.jpg',
          },
          quantity: item.quantity,
          price: item.price,
        })),
      }));
    //   //wallet pagination things
      let walletTransactions=userData.wallet.transactions.slice().reverse()
      const tpages=Math.ceil((walletTransactions.length)/perPage)
      const paginationWallet = walletTransactions.slice((walltPage - 1) * perPage, walltPage * perPage);


      
      
      res.render('profile', {
        user: userData,
        userAddress: addressData,
        orders: formattedOrders,
        totalPages,
        currentPage: page,
        search,
        paginationWallet,
        tpages,
        walltCurrentPage:walltPage
      });
  
    } catch (error) {
      console.error('error in the user profile page', error);
      res.status(500).redirect('/pageNotFound');
    }
  };
  
const changeEmail=async (req,res)=>{

    try {
         
        const {email}=req.body;
        const userExist= await User.findOne({email:email})
        if(userExist){
            const otp=generateOtp();
            const emailSent=await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp=otp;
                req.session.userData=req.body;
                req.session.email=email;
                res.render('profileEmailChangeOtp')
                console.log('Email sent:',email);
                console.log('OTP:', otp)
                
            }
            else{
                res.json('email-error');
            }
        }
        else{ 
            res.json('user not find for change email')

        }
    } catch (error) {
        console.error('error in cahnge email',error)
        res.status(500).redirect('/pageNotFound')
    }
}

const verifyEmailChangeOtp=async (req,res)=>{
    try {
        const enterOtp=req.body.otp;
        if(enterOtp===req.session.userOtp){
            req.session.userData=req.body.userData;
            res.json({success:true,redirectUrl:'/new-email-page'})
            
        }
        else{
            res.json({success:false,message:"otp verification failed"})
        }
        
    } catch (error) {
        res.status(500).json({success:fasle,message:"An error occured.Please try again"})

        
    }
   
}
const getNewEmailPage=async(req,res)=>{
    try {
        res.render('new-email')
    } catch (error) {
        console.error('error in getting new email page',error)
        res.status(500).redirect('/pageNotFound')
    }
}

const updateEmail=async(req,res)=>{
    try {
        const {newEmail}=req.body;
        const userId=req.session.user;
        await User.findByIdAndUpdate(userId,{email:newEmail})
        res.redirect('/userProfile')
    } catch (error) {
        console.error('error in updating the email',error)
        res.status(500).redirect('/pageNotFound')
    }
}

const changePassword=async(req,res)=>{
    try {
        res.render('change-password')
    } catch (error) {
        console.error('error in changing password',error)
        res.status(500).redirect('/pageNotFound')
    }
}

const changePasswordValid=async(req,res)=>{
    try {
        const{email}=req.body
        const userExist=await User.findOne({email})
        if(userExist){
            const otp=generateOtp();
            const emailSent=await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp=otp;
                req.session.userData=req.body;
                req.session.email=email;
                res.render('change-password-otp')
                console.log('OTP:',otp);

            }
            else{
                res.json({
                    success:false,
                    message:"failed to send otp. please try again"
                })
            }
        }
        else{
            res.render('change-password',{message:"user not exist. enter valid email"})
        }

    } catch (error) {
        console.error('error in changing password',error)
        res.status(500).redirect('/pageNotFound')
    }
}

const verifyChangePasswordOtp=async(req,res)=>{
    try {
        const enterOtp=req.body.otp;
        if(enterOtp===req.session.userOtp){
            res.json({success:true,redirectUrl:'/reset-password'})

        }
        else[
            res.json({success:false,message:"otp not matching"})
        ]
    } catch (error) {
        console.error("error in changing password",error)
        res.status(500).json({success:false,message:"an error occured ,please try again later"})
    }
}


//address management
const addAddress=async(req,res)=>{
    try {
        const user=req.session.user;
        const returnTo = req.query.returnTo;
        res.render('add-address',{user:user})
    } catch (error) {
        console.error('error in add address page loading: ',error)
        res.status(500).redirect('/pageNotFound')
    }
}
const postAddAddress=async(req,res)=>{
    try {
       const userId=req.session.user;
       const returnTo=req.query.returnTo || req.body.returnTo;
       const userData=await User.findOne({_id:userId}) 
       const {addressType,name,city,landMark,state,pincode,phone,altPhone}=req.body
       const userAddress=await Address.findOne({userId:userData._id})
       if(!userAddress){
            const newAddress=new Address({
                userId:userData._id,
                address:[{addressType,name,city,landMark,state,pincode,phone,altPhone}]

            })
            await newAddress.save();
 
       }
       else{
            userAddress.address.push({addressType,name,city,landMark,state,pincode,phone,altPhone})
            await userAddress.save();
       }

       if (returnTo === 'checkout') {         
            return res.redirect('/checkout');  
       }

       res.redirect('/userProfile')
    } catch (error) {
        console.error('error in adding new address',error)
        res.status(500).redirect('/pageNotFound')        
    }
}
const editAddress=async(req,res)=>{
    try {
        const addressId=req.query.id;
        const returnTo = req.query.returnTo; 
        const user=req.session.user;
        const currentAddress=await Address.findOne({"address._id":addressId})
        if(!currentAddress){
            return res.redirect('/pageNotFound')
        }
        const addressData=currentAddress.address.find((item)=>{
            return item._id.toString()===addressId.toString();
        })
        if(!addressData){
            return res.redirect('/pageNotFound');
        }
        res.render('edit-Address',{address:addressData,user:user,returnTo:returnTo})
    } catch (error) {
        console.error('error in load edit address page',error)
        res.status(500).redirect('/pageNotFound')
    }

}
const postEditAddress=async(req,res)=>{
    try {
        const data=req.body;
        const {id}=req.query;
        const returnTo=req.query.returnTo || req.body.returnTo;
        const user=req.session.user;
        const findAddress=await Address.findOne({"address._id":id})
        if(!findAddress){
            res.redirect('/pageNotFound')
        }
        await Address.updateOne(
            {"address._id":id},
            {$set:{
                "address.$":{
                    _id:id,
                    addressType:data.addressType,
                    name:data.name,
                    city:data.city,
                    landMark:data.landMark,
                    state:data.state,
                    pincode:data.pincode,
                    phone:data.phone,
                    altPhone:data.altPhone
                }
            }}
        )
         
         
        if (returnTo === 'checkout') {
            return res.redirect('/checkout');  
        }

        res.redirect('/userProfile')
    } catch (error) {
        console.error('error in the editing of address',error)
        res.redirect('/pageNotFound')
        
    }
}

const deleteAddress=async(req,res)=>{
    try {
        const addressId=req.query.id;
        const findAddress=await Address.findOne({"address._id":addressId})
        if(!findAddress){
            return res.status(404).send('address not found')

        }
        await Address.updateOne({
            "address._id":addressId
        },
        {$pull:{
            address:{
                _id:addressId
            }
        }}
    )
    res.redirect('/userProfile#address')
    } catch (error) {
        console.error("error in delete address: ",error)
        res.redirect('/pageNotFound')
    }
}

module.exports={
    getForgotPassword,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    changeEmail,
    verifyEmailChangeOtp,
    getNewEmailPage,
    updateEmail,
    changePassword,
    changePasswordValid,
    verifyChangePasswordOtp,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress
   
}