const Brand=require('../../models/brandSchema')
const Product=require('../../models/productSchema')

const getBrandPage=async(req,res)=>{
    try {
        const page=parseInt(req.query.page)||1;
        const limit=3;
        const skip=(page-1)*limit;
        const brandData=await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit);
        const allBrand=await Brand.find({},{brandName:1,_id:0})
        const brandNames=allBrand.map(brand=>brand.brandName)
        
        const totalBrands=await Brand.countDocuments();
        
        const totalPages=Math.ceil(totalBrands/limit);
         
       
        res.render("brands",{
            data:brandData,
            totalPages:totalPages,
            totalBrands:totalBrands,
            currentPage:page,
            brandNames


        })
        
    } 
    catch (error) {
        console.log('error in the getBrandPage',error);
        res.redirect('/admin/pageerror')
    }

}
 
const addBrand=async (req,res)=>{
    try {
        const brand=req.body.name;
        const findBrand=await Brand.findOne({brand});
        if(!findBrand){
            const image=req.file.filename;
            const newBrand=new Brand({
                brandName:brand,
                brandImage:image,
            })
            await newBrand.save();
            res.redirect("/admin/brands")
        }
        
    } catch (error) {
        res.redirect('/admin/pageerror')

        
    }

}

const blockBrand=async (req,res)=>{
    try {
        const id=req.query.id;
        const page=req.query.page || 1;
        await Brand.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect(`/admin/brands?page=${page}`)
    } catch (error) {
        console.log('error is blocking the brand',error)
        res.redirect('/admin/pageerror')
    }
   
}
const unblockBrand=async (req,res)=>{
    try {
        const id=req.query.id;
        const page=req.query.page || 1;
        await Brand.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect(`/admin/brands?page=${page}`)
    } catch (error) {
        console.log('unblock the brand error',error)
        res.redirect('/admin/pageerror')
        
    }

}
const deleteBrand=async(req,res)=>{
    try {
        const {id}=req.query
        const page=req.query.page || 1;
        if(!id){
            return res.status(400).redirect('/admin/pageerror')

        }
        await Brand.deleteOne({_id:id});
        res.redirect(`/admin/brands?page=${page}`)
    } catch (error) {
        console.log('delete brand error:',error)
        res.redirect('/admin/pageerror')
        
    }
}


module.exports={
    getBrandPage,
    addBrand,
    blockBrand,
    unblockBrand,
    deleteBrand
}