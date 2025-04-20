const User = require("../../models/userSchema");



const getAddMoneyPage=async(req,res)=>{
    try {
        res.render('walletAddMoney')
    } catch (error) {
        
    }
}
const addMoney=async(req,res)=>{
    try {
        const userId=req.session.user._id;
        const amount=parseInt(req.body.amount);
        const user=await User.findById(userId);
        user.wallet.balance +=amount;
        user.wallet.transactions.push({
            date:new Date,
            status:'Credited',
            amount:amount
        });
        await user.save()
        res.redirect('/userProfile#track-orders')

    } catch (error) {
        console.error('error in adding money to wallet',error);
        res.status(500).redirect('/pageNotFound')
    }
}

module.exports={
    getAddMoneyPage,
    addMoney
}