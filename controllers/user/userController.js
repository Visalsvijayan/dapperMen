
const User=require('../../models/userSchema')
const Category=require('../../models/categorySchema')
const Product=require('../../models/productSchema')
const Brand=require('../../models/brandSchema')
const {generateReferralCoupon}=require('../../controllers/admin/coupenController')
const bcrypt=require('bcrypt');
const env=require('dotenv').config();
const nodemailer=require('nodemailer');
const statusCode=require('../../config/statusCode')
 
const loadHomepage=async(req,res)=>{
    try {
      const user=req.session.user;

      const categories=await Category.find({isListed:true})
      let productData=await Product.find(
        {isBlocked:false,
        category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}
        }
     );
        
     productData.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
     productData=productData.slice(0,4);
     

      if(user){
             
            let userData=await User.findOne({_id:user._id,isAdmin:false})

            if(!userData||userData.isBlocked){
                 req.session.destroy(); // Remove session
                 userData = null;
                 res.redirect('/login')
            }

            return res.render('home',{user:userData,products:productData,session:req.session})
            
        }
        else{
            
            return res.render('home',{selectPage:'home',user:null,products:productData})
 
        }
        
    } catch (error) {
        console.log('home page is not found',error)
        res.status(statusCode.INTERNAL_SERVER_ERROR).send('server error')
        
    }
}
 
const pageNotFound=async (req,res)=>{
    try {
        res.status(statusCode.NOT_FOUND).render("page-404")
    } catch (error) {
        res.redirect('/pageNotFound')
        
    }
}

const loadLogin=async(req,res)=>{
    try {
        if(!req.session.user){
            return res.render('login',{message:""});
        }
        else{
            res.redirect("/")
        }    
 
    } catch (error) {
        console.error("Error loading login page:", error); // Log the error
        res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/pageNotFound")
        
    }
}
const login=async (req,res)=>{
    try {
        const {email,password}=req.body;
         
        const findUser=await User.findOne({email:email})
         
         
        if(!findUser){
            return res.render('login',{message:"User not found"})
        }
        if(findUser.isBlocked){
            return res.render('login',{message:'User is blocked by admin'})
        }
        const passwordMatch=await bcrypt.compare(password,findUser.password)
        if(!passwordMatch){
            return res.render('login',{message:"Incorrect password"})

        }
        //storing the session
        req.session.user = {
            _id: findUser._id.toString(),  // Convert ObjectId to string
            name: findUser.name,
            email: findUser.email
        };

        res.redirect('/');
    } catch (error) {
        console.log("login error ",error)
        res.render("login",{message:"login failed, please try again"})
    }
}

const loadSignup=async(req,res)=>{
    try {
        const referralCodeFromUrl=req.query.ref;
        return res.render('signup',{
            message:"",
            referralCode:referralCodeFromUrl || ''
        })
    } catch (error) {
        console.error("Error loading signup page:", error); // Log the error
        res.status(500).send("Internal Server Error");
    }
}

 
const signup=async (req,res)=>{
    try {
        
        const{name,phone,email,password,confirm_password,referralCode}=req.body
        if(password!==confirm_password){
            return res.render("signup",{message:"password do not match",referralCode:''})
        }
        const findUser=await User.findOne({email});
        if(findUser){
            return res.render('signup',{message:"user with same email already exist",referralCode:''});
        }
        const findPhone=await User.findOne({phone})
        if(findPhone){
            return res.render('signup',{message:"User with same phone number aleady exist",referralCode:''});
        }

        const otp=generateOtp();
        const emailSent=await sendVerificationEmail(email,otp)
        if(!emailSent){
            return res.json('email-error')
        }
        req.session.userOtp=otp;
        req.session.userData={email,password,name,phone,referralCode}
        
        res.render('verify-otp')
        console.log("otp email:",otp)

    } catch (error) {
        console.log('signup error',error);
        res.redirect("/pageNotFound")
    }
}
//function used to send otp: email verification
function generateOtp(){
    return Math.floor(100000+ Math.random()*900000).toString();
}
async function sendVerificationEmail(email,otp){
    try {
        const transporter=nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }

        })

        const info=await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"verify your account",
            text:`your OTP is ${otp}`,
            html:`<b>Your OTP: ${otp}</b>`
        })
        return info.accepted.length>0
    } catch (error) {
        console.log('error sending otp email',error)
        return false;
        
    }
} 

const resendOtp=async (req,res)=>{
    try {
        const {email}=req.session.userData;
        
        if (!req.session.userData || !req.session.userData.email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }
        
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
        const otp=generateOtp();
        req.session.userOtp=otp;
        const emailSent=await sendVerificationEmail(email,otp)
        if(emailSent){
            console.log('resend OTP:',otp);
            res.status(200).json({success:true,message:"OTP resend successfully"})
        }
        else{
            res.status(500).json({success:false,message:"failed to resend OTP,please try again"})
        }
    } catch (error) {
        console.log("Error resending OTP")
        res.status(500).json({success:false,message:"internal server Error"})
        
    }
}

//function to generate referal code
const generateReferralCode = (name) => {
    const firstName = name.trim().split(' ')[0].toUpperCase();
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${firstName}-${randomStr}`;
  };

const verifyOtp=async(req,res)=>{
    try {
        const {otp}=req.body;
        const user=req.session.userData
        const refCode=generateReferralCode(user.name)
        let referrer=null
        if(user.referralCode){
            referrer=await User.findOne({referralCode:user.referralCode})
        }
        if(otp===req.session.userOtp){
           
           const passwordHash=await securePassword(user.password);
           const saveUserData=new User({
            name:user.name,
            email:user.email,
            phone:user.phone,
            password:passwordHash,
            referralCode:refCode,
            referredBy:referrer ? referrer._id : null,

           }) 
           await saveUserData.save();
          
            if(user.referralCode &&referrer){
 
                
                await generateReferralCoupon(referrer._id);
        
            }
           

           res.json({success:true,redirectUrl:"/login"})
   
        }
        else{
            res.status(400).json({success:false,message:"Invalid OTP,please try again"})
        }
      
    } catch (error) {
        console.log('Error verifying otp',error);
        res.status(500).json({success:false,message:"An error occured during verifying otp"})
    }
}
const securePassword=async (password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10)
        return passwordHash;
    } catch (error) {
         throw error;
    }
}

const logout=async (req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log('session destruction error in while logout',err.message)
                return res.redirect('/pageNotFound')
            }
            return res.redirect('/login') 
        })
        
    } catch (error) {
        console.log('Logout error',error)
        res.redirect('/pageNotFound')
    }

}




module.exports={loadHomepage,
    pageNotFound,
    loadLogin,
    loadSignup,
    signup,
    resendOtp,
    verifyOtp,
    login,
    logout,

    
     
    
    
}


