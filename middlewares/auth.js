const User=require('../models/userSchema')
const userAuth=(req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data&&!data.isBlocked){
                next();
            }
            else if(data&&data.isBlocked){
                req.session.destroy(()=>{
                 return res.redirect('/')
                })

            }
            else{
                res.redirect('/login')
                next()
            }
        })
        .catch(error=>{
            console.log("error is user auth midddleware",error)
            res.status(500).send('internal server error')
        })
    }
    else{
        res.redirect('/login')
    }
}

const adminAuth=(req,res,next)=>{
    if(req.session.admin){

        User.findOne({isAdmin:true})
        .then(data=>{
            if(data){
                next();
            }
            else{
                res.redirect('/admin/login')
            }
        })
        .catch(error=>{
            console.log("error in adminauth middleware",error);
            res.status(500).send('internal server error')
        })
    }
    else{
        res.redirect('/admin/login')
    }
   
}
 
module.exports={
    userAuth,
    adminAuth
}
