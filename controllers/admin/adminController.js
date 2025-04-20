const User=require('../../models/userSchema');
const mongoose=require('mongoose');
const bcrypt=require('bcrypt');




const loadLogin=async(req,res)=>{
    if(req.session.admin){
        return res.redirect('/admin')
    }
    res.render('admin-login')
}
const login=async(req,res)=>{
    try {
        const {email,password}=req.body;
        const admin=await User.findOne({email,isAdmin:true})
        if(admin){
            const passwordMatch=await bcrypt.compare(password,admin.password)
            if(passwordMatch){
                req.session.admin=true;
                return res.redirect("/admin");

            }
            else{
                return res.redirect('/admin/login')
            }
        }
        else{
            return res.redirect('/admin/login')

        }
    } catch (error) {
        console.log('admin login error',error)
        return res.redirect('/pageerror')
        
    }
}
const loadDashboard=async (req,res)=>{
    // if(!req.session.admin){
    //     res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    //     res.set('Pragma', 'no-cache');
    //     res.set('Expires', '-1');
        
    //     return res.redirect('/admin/login')
    // }
    
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '-1');
        if(req.session.admin){
            res.render('dashboard')
        }
        
    } catch (error) {
        console.log("error in loaddashboard",error)
        res.redirect('/admin/pageerror')
        
    }
    

}
 

const logout = async (req, res) => {
    try {
         
        req.session.destroy((err) => {
           
            if (err) {
                console.log('Error in logout admin:', err);
                return res.redirect('/admin/pageerror');
            }
            
            res.clearCookie('connect.sid'); //  cookie is removed
           
            return res.redirect('/admin/login');
        });
    } catch (error) {
        console.log('Error during logout admin:', error);
        return res.redirect('/admin/pageerror');
    }
};

 

const pageerror=async (req,res)=>{
    res.render('pageerror')
}
const dashboard=async (req,res)=>{
    res.render('dashboard')
}

module.exports={
    loadLogin,
    login,
    loadDashboard,
    logout,
    pageerror,
    dashboard
}