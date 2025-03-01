const express=require('express');
const app=express();
const nodemon=require('nodemon')
const env=require('dotenv').config();
const connectDB=require('./config/db');
connectDB();











app.listen(process.env.PORT,()=>console.log('server started'))
module.exports=app;
