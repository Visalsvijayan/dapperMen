
const User=require('../../models/userSchema')
const Category=require('../../models/categorySchema')
const Product=require('../../models/productSchema')
const Brand=require('../../models/brandSchema')
const {generateReferralCoupon}=require('../../controllers/admin/coupenController')
const bcrypt=require('bcrypt');
const env=require('dotenv').config();
const nodemailer=require('nodemailer')
const loadHomepage=async(req,res)=>{
    try {
      const user=req.session.user;
      const categories=await Category.find({isListed:true})
      let productData=await Product.find(
        {isBlocked:false,
        category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}
        }
     );
       const admin=req.session.admin
     productData.sort((a,b)=>new Date(b.createOn)-new Date(a.createOn));
     productData=productData.slice(0,4);
     

      if(user){
             
            const userData=await User.findOne({_id:user._id,isAdmin:false})
            return res.render('home',{user:userData,products:productData})
            
        }
        else{
            
                return res.render('home',{user:null,products:productData})

            
           
        }
        
    } catch (error) {
        console.log('home page is not found')
        res.status(500).send('server error')
        
    }
}

const pageNotFound=async (req,res)=>{
    try {
        res.render("page-404")
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
        res.status(500).redirect("/pageNotFound")
        
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

// const signup=async (req,res)=>{
//     const {name,email,phone,password}= req.body
//     try {
//         const newUser=new User({name,email,phone,password})
//         console.log(newUser)
//         await newUser.save();
//         res.render('login')
//     } catch (error) {
//         console.error("Error  signup :", error); // Log the error
//         res.status(500).send("Internal Server Error in signup");
        
//     }
// }
const signup=async (req,res)=>{
    try {
        
        const{name,phone,email,password,confirm_password,referralCode}=req.body
        if(password!==confirm_password){
            return res.render("signup",{message:"password do not match"})
        }
        const findUser=await User.findOne({email});
        if(findUser){
            return res.render('signup',{message:"user with same email already exist"});
        }
        const findPhone=await User.findOne({phone})
        if(findPhone){
            return res.render('signup',{message:"User with same phone numver aleady exist"});
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
 
                console.log('referrer present:',referrer)
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



const loadShoppingPage = async(req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({_id: user});
        const categories = await Category.find({isListed: true});
        const categoryIds = categories.map((category) => category._id.toString());
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        // Get all filter parameters from query including search query
        const { category, brand, gt, lt, sort, query } = req.query;
        
        // Build base query
        let queryObj = {
            isBlocked: false,
            category: {$in: categoryIds},
            quantity: {$gt: 0}
        };
        
        // Apply search query if exists
        if (query) {
            queryObj.productName = { $regex: new RegExp(query, "i") };
        }

        // Apply other filters
        if (category) queryObj.category = category;
        if (brand) {
            const brandDoc = await Brand.findById(brand);
            if (brandDoc) {
                queryObj.brand = brandDoc.brandName;
            }
        }

        if (gt || lt) {
            queryObj.salePrice = {};
            if (gt) queryObj.salePrice.$gte = Number(gt);
            if (lt) queryObj.salePrice.$lte = Number(lt);
        }
        
        // Get products with filters
        let products = await Product.find(queryObj)
            .sort({createdOn: -1})
            .skip(skip)
            .limit(limit);
            
        // Apply additional sorting if specified
        if (sort) {
            switch(sort) {
                case 'price-low-high':
                    products.sort((a, b) => a.salePrice - b.salePrice);
                    break;
                case 'price-high-low':
                    products.sort((a, b) => b.salePrice - a.salePrice);
                    break;
                case 'oldest':
                    products.sort((a, b) => new Date(a.createdOn) - new Date(b.createdOn));
                    break;
            }
        }
        
        const totalProducts = await Product.countDocuments(queryObj);
        const totalPages = Math.ceil(totalProducts / limit);
        const brands = await Brand.find({isBlocked: false});
        
        res.render('shop', {
            user: userData,
            products: products,
            category: categories.map(category => ({_id: category._id, name: category.name})),
            brand: brands,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
            
            selectedCategory: category || null,
            selectedBrand: brand || null,
            priceRange: {
                gt: gt || '',
                lt: lt || ''
            },
            currentSort: sort || 'newest',
            query: query || ''  
        });
        
    } catch (error) {
        console.error("load shopping page error", error);
        res.status(500).redirect('/pageNotFound');
    }
};

  

 
const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const { category, brand, gt, lt, sort, page, query } = req.query;
        
         
        let filter = { 
            isBlocked: false, 
            quantity: { $gt: 0 } 
        };
 
        if (query) {
            filter.productName = { $regex: new RegExp(query, "i") };
        }

        
        if (category) {
            filter.category = category;
        }

         
        if (brand) {
             
            const brandDoc = await Brand.findById(brand);
            if (brandDoc) {
                filter.brand = brandDoc.brandName; // Match exact brand name string
            }
        }


        // Apply price range filter
        if (gt || lt) {
            filter.salePrice = {};
            if (gt) filter.salePrice.$gte = Number(gt);
            if (lt) filter.salePrice.$lte = Number(lt);
        }

        // Get categories and brands for sidebar
        const [categories, brands] = await Promise.all([
            Category.find({ isListed: true }).lean(),
            Brand.find({ isBlocked: false }).lean()
        ]);

        // Get filtered products
        let products = await Product.find(filter).lean();

        // Apply sorting
        switch(sort) {
            case 'price-low-high':
                products.sort((a, b) => a.salePrice - b.salePrice);
                break;
            case 'price-high-low':
                products.sort((a, b) => b.salePrice - a.salePrice);
                break;
            case 'oldest':
                products.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            default: // 'newest' or default
                products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        // Pagination
        const itemsPerPage = 9;  
        const currentPage = parseInt(page) || 1;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedProducts = products.slice(startIndex, startIndex + itemsPerPage);
        const totalPages = Math.ceil(products.length / itemsPerPage);

         
        const userData = user ? await User.findOne({ _id: user }) : null;

        res.render('shop', {
            user: userData,
            products: paginatedProducts,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            query: query || '',  
            selectedCategory: category || null,
            selectedBrand: brand || null,
            priceRange: { gt: gt || '', lt: lt || '' },
            currentSort: sort || 'newest'
        });

    } catch (error) {
        console.error('Error in filter product:', error);
        res.status(500).redirect('/pageNotFound');
    }
};


module.exports={loadHomepage,
    pageNotFound,
    loadLogin,
    loadSignup,
    signup,
    resendOtp,
    verifyOtp,
    login,
    logout,
    loadShoppingPage,
    filterProduct,
     
    
    
}


