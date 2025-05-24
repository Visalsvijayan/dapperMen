const User=require('../../models/userSchema')

const customerInfo=async (req,res)=>{
    try {
        let search="";
        if(req.query.search){
            search=req.query.search;
        }
        let page=1;
        if(req.query.page){
            page=parseInt(req.query.page)
        }
        const limit=3;
        const userData=await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ]
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec();

        const count=await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ]
        
        }).countDocuments();
       
        res.render('customers',{
            data:userData,
            totalPages: Math.ceil(count/limit),
            currentPage:page




        })


    } catch (error) {
        console.log("customer info error",error)
        
    }


}

const customerBlocked=async (req,res)=>{
    try {
        let id=req.query.id;
        const page=req.query.page;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
         
        res.redirect(`/admin/users?page=${page}`)
    } catch (error) {
        console.log("error in blocking the customer ",error)
        res.status(500).redirect('admin/pageerror') 
    }
}

const customerUnblocked=async (req,res)=>{
    try {
        let id=req.query.id;
         const page=req.query.page;
        await User.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect(`/admin/users?page=${page}`)
    } catch (error) {
        console.log('error in unblocking customer')
        res.redirect('admin/pageerror')
        
    }
}


module.exports={
    customerInfo,
    customerBlocked,
    customerUnblocked
}