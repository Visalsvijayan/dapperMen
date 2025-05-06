const Product=require('../../models/productSchema');
const Category=require('../../models/categorySchema');
const User=require('../../models/userSchema')
const Brand=require('../../models/brandSchema')
const mongoose=require('mongoose')




const loadShoppingPage = async(req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({_id: user});
        const categories = await Category.find({isListed: true});
        const categoryIds=categories.map((category)=>new mongoose.Types.ObjectId(category._id))
        const brandss=await Brand.find({isBlocked:false})
        const brandnames=brandss.map((brand)=>brand.brandName)
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        // Get all filter parameters from query including search query
        const { category, brand, gt, lt, sort, query } = req.query;
        
        // Build base query
        let queryObj = {
            isBlocked: false,
            category: {$in: categoryIds},
            brand:{$in:brandnames},

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
            .sort({createdAt: -1})
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
                default: // 'newest' or default
                    products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));    
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
        const userData = await User.findOne({_id: user});
         const { category, brand, gt, lt, sort, page, query } = req.query;
        
         
        let filter = { 
            isBlocked: false, 
            quantity: { $gt: 0 } 
        };
 
        if (query) {
            filter.productName = { $regex: new RegExp(query, "i") };
        }

        
        // if (category) {
        //     filter.category = category;
        // }
        if (category) {
            const isListedCategory = await Category.findOne({ _id: category, isListed: true });
            if (isListedCategory) {
              filter.category = category;
            } else {
              // prevent filtering by an unlisted category
              filter.category = { $in: (await Category.find({ isListed: true })).map(cat => cat._id) };
            }
          } else {
            filter.category = { $in: (await Category.find({ isListed: true })).map(cat => cat._id) };
          }

         
        // if (brand) {
        //     const isUnblockedBrand=await Brand.findOne({brandName:brand,isBlocked:false})
        //     // const brandDoc = await Brand.findById(brand);
        //     if (isUnblockedBrand) {
        //         filter.brand = isUnblockedBrand.brandName; // Match exact brand name string
        //     }
        //     else{
        //         filter.brand={$in:(await Brand.find({isBlocked:false})).map(brand=>brand.brandName)}
        //     }
        // }
        // else{
        //     filter.brand={$in:(await Brand.find({isBlocked:false})).map(brand=>brand.brandName)}

        //  }
        if (brand) {
            const brandDoc = await Brand.findOne({ _id: brand, isBlocked: false });
            if (brandDoc) {
                filter.brand = brandDoc.brandName; // match the brand name in Product.brand
            } else {
                filter.brand = {
                    $in: (await Brand.find({ isBlocked: false })).map(b => b.brandName)
                };
            }
        } else {
            filter.brand = {
                $in: (await Brand.find({ isBlocked: false })).map(b => b.brandName)
            };
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

         
 
        res.render('shop', {
            user:userData,
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


const productDetails=async(req,res)=>{
    try {
        const userId=req.session.user;
        const userData=await User.findById(userId);
        const productId=req.query.id;
        const product=await Product.findById(productId).populate('category');
        const findCategory=product.category;
        const categoryOffer=findCategory ? findCategory.categoryOffer||0 : 0
        const productOffer=product.productOffer||0;
        const finalOffer=categoryOffer>productOffer ? categoryOffer:productOffer
        res.render('details-pro',{
            user:userData,
            product:product,
            quantity:product.quantity,
            finalOffer:finalOffer,
            category:findCategory

        })
    } catch (error) {
        console.error('error in product details',error)
        res.status(500).redirect('/pageNotFound')
    }
}




module.exports={
    productDetails,
    loadShoppingPage,
    filterProduct,

}