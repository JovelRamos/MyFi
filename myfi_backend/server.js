const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = 8000;

const uri =
    "mongodb+srv://jovel:423275077127@myfi.ezmdt.mongodb.net/?retryWrites=true&w=majority&appName=myfi"

async function connect(){

    try{
        await mongoose.connect(uri);
        console.log("Successful connection to MongoDB")
    }catch(error){

        console.log(error);
    }
}

connect();

app.listen(PORT, () => console.log(`Server started on ${PORT}`));