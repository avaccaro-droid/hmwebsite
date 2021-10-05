//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');

const app = express();

app.use(express.static("public"));

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
	extended: true,
}));

app.use(session({
	secret: "Our little secret.",
	resave: false,
	saveUninitialized: false,
}));

app.use(passport.initialize());

app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true});

const userSchema = new mongoose.Schema({
	email: String,
	password: String,
	secret: String,
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//create mongoose db schemas & models (tables) here
const orderHeaderSchema = new mongoose.Schema({
	orderNumber: String,
	season: String,
	itemCountRequired: String,
});
const OrderHeader = new mongoose.model("OrderHeader", orderHeaderSchema);

app.get("/", function(req, res) {
	res.sendFile(__dirname + "/index.html");
});

app.get("/index.html", function(req, res) {
	res.sendFile(__dirname + "/index.html");
});

app.get("/login.html", function(req, res) {
	res.sendFile(__dirname + "/login.html");
});

app.get("/logout.html", function(req, res) {
	req.logout();
	res.sendFile(__dirname + "/index.html");
});

app.get("/initiate-purchase-order.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		res.sendFile(__dirname + "/initiate-purchase-order.html");
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.post("/login.html", function(req, res) {
	const user = new User({
		username: req.body.username,
		password: req.body.password,
	});

	req.login(user, function(err) {
		if (err) {
			console.log(err);
		} else {
			passport.authenticate("local", { failureRedirect: req.headers.referer })(req, res, function() {
				res.redirect(req.headers.referer);
			});
		}
	});
});

app.post("/initiate-purchase-order.html", function(req, res) {
	const orderHeader = new OrderHeader({
		orderNumber: req.body.orderNumber,
		season: req.body.season,
		itemCountRequired: req.body.itemCountRequired,
	});

	orderHeader.save(function() {
		res.sendFile(__dirname + "/index.html");
	});
});

app.listen(80, function() {
	console.log("Server started on port 3000.");
});
