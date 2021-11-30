//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const session = require('express-session');
const passport = require('passport');
const Strategy = require('passport-local').Strategy;
const uuid = require('uuid');
const AWS = require('aws-sdk');
AWS.config.update({
    region: "eu-west-2",
});
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
	extended: true,
}));
app.use(session({
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new Strategy(function (username, password, cb) {
    const params = {
        TableName: process.env.DYNAMODB_USER_TABLE_NAME,
        FilterExpression: "#username = :username AND #password = :password",
        ExpressionAttributeNames: {
            "#username": "username",
            "#password": "password",
        },
        ExpressionAttributeValues: {
            ":username": username,
            ":password": password,
        },
    };

    //get user
    dynamoDb.scan(params, (error, result) => {
    	if (error) {
    		console.error(error);
    	}

    	//is there an object where username & password match?
    	if (result.Count > 0) {
    		const user = result.Items[0];

    		if (user !== null && typeof user !== 'undefined') {
    			return cb(null, user);
    		}
    	}

		return cb(null, false);
    });
}));
passport.serializeUser(function(user, cb) {
	cb(null, user.id);
});
passport.deserializeUser(function(id, cb) {
	const params = {
        TableName: process.env.DYNAMODB_USER_TABLE_NAME,
        Key: {
            id: id,
        },
    };

    dynamoDb.get(params, (error, result) => {
    	if (error) {
    		console.error(error);
    	}

    	const user = result.Item;

    	if (user !== null && typeof user !== 'undefined') {
			cb(null, user);
    	}
    });
});

//custom methods
function propertyValid(property) {
	return property !== null && typeof property !== 'undefined' && property.length > 0;
}

function orderHeaderValid(orderHeader) {
	let valid = false;

	if (orderHeader !== null && typeof orderHeader !== 'undefined') {
		valid = orderHeader.orderNumber !== null && typeof orderHeader.orderNumber !== 'undefined' && orderHeader.orderNumber.length === 6
		&& orderHeader.ss !== null && typeof orderHeader.ss !== 'undefined'
		&& orderHeader.yyyy !== null && typeof orderHeader.yyyy !== 'undefined'
		&& orderHeader.itemCountRequired !== null && typeof orderHeader.itemCountRequired !== 'undefined' && orderHeader.itemCountRequired.length > 0
		&& orderHeader.customerId !== null && typeof orderHeader.customerId !== 'undefined';
	}

	return valid;
}

function orderHeaderSearchValid(orderHeader) {
	let valid = false;

	if (orderHeader !== null && typeof orderHeader !== 'undefined') {
		valid = orderHeader.customerId !== null && typeof orderHeader.customerId !== 'undefined';
	}

	return valid;
}

function strictOrderHeaderSearchValid(orderHeader) {
	let valid = false;

	if (orderHeader !== null && typeof orderHeader !== 'undefined') {
		valid = orderHeader.customerId !== null && typeof orderHeader.customerId !== 'undefined' && orderHeader.customerId.length > 0
		&& orderHeader.orderNumber !== null && typeof orderHeader.orderNumber !== 'undefined' && orderHeader.orderNumber.length > 0
		&& orderHeader.season !== null && typeof orderHeader.season !== 'undefined' && orderHeader.season.length > 0;
	}

	return valid;
}

function getOrderHeaderSearchParams(orderHeader, closedOnly) {
	let filterExpression = "#customerId = :customerId";
	let expressionAttributeNames = "{\"#customerId\": \"customerId\"";
	let expressionAttributeValues = "{\":customerId\": \"" + orderHeader.customerId + "\"";

	//did the user give us valid order number data?
	if (orderHeader.orderNumber !== null && typeof orderHeader.orderNumber !== 'undefined' && orderHeader.orderNumber.length > 0) {
		filterExpression += " and #orderNumber = :orderNumber";
		expressionAttributeNames += ",\"#orderNumber\": \"orderNumber\"";
		expressionAttributeValues += ",\":orderNumber\": \"" + orderHeader.orderNumber + "\"";
	}

	//did the user give us valid season data?
	if (orderHeader.season !== null && typeof orderHeader.season !== 'undefined' && orderHeader.season.length > 0) {
		filterExpression += " and #season = :season";
		expressionAttributeNames += ",\"#season\": \"season\"";
		expressionAttributeValues += ",\":season\": \"" + orderHeader.season + "\"";
	}

	//are we searching for closed orders only?
	if (closedOnly) {
		filterExpression += " and #orderStatus = :orderStatus";
		expressionAttributeNames += ",\"#orderStatus\": \"orderStatus\"";
		expressionAttributeValues += ",\":orderStatus\": \"CLOSED\"";
	}

	expressionAttributeNames += "}";
	expressionAttributeValues += "}";

	const params = {
		TableName: process.env.DYNAMODB_ORDER_HEADER_TABLE_NAME,
		FilterExpression: filterExpression,
		ExpressionAttributeNames: JSON.parse(expressionAttributeNames),
    	ExpressionAttributeValues: JSON.parse(expressionAttributeValues),
	};

	return params;
}

function getOrderDetailSearchParams(orderHeader) {
	let filterExpression = "#customerId = :customerId";
	let expressionAttributeNames = "{\"#customerId\": \"customerId\"";
	let expressionAttributeValues = "{\":customerId\": \"" + orderHeader.customerId + "\"";

	//did the user give us valid order number data?
	if (orderHeader.orderNumber !== null && typeof orderHeader.orderNumber !== 'undefined' && orderHeader.orderNumber.length > 0) {
		filterExpression += " and #orderNumber = :orderNumber";
		expressionAttributeNames += ",\"#orderNumber\": \"orderNumber\"";
		expressionAttributeValues += ",\":orderNumber\": \"" + orderHeader.orderNumber + "\"";
	}

	//did the user give us valid season data?
	if (orderHeader.season !== null && typeof orderHeader.season !== 'undefined' && orderHeader.season.length > 0) {
		filterExpression += " and #season = :season";
		expressionAttributeNames += ",\"#season\": \"season\"";
		expressionAttributeValues += ",\":season\": \"" + orderHeader.season + "\"";
	}

	expressionAttributeNames += "}";
	expressionAttributeValues += "}";

	const params = {
		TableName: process.env.DYNAMODB_ORDER_DETAIL_TABLE_NAME,
		FilterExpression: filterExpression,
		ExpressionAttributeNames: JSON.parse(expressionAttributeNames),
    	ExpressionAttributeValues: JSON.parse(expressionAttributeValues),
	};

	return params;
}

function exportHeaderSearchValid(exportHeader) {
	let valid = false;

	if (exportHeader !== null && typeof exportHeader !== 'undefined') {
		valid = exportHeader.customerId !== null && typeof exportHeader.customerId !== 'undefined';
	}

	return valid;
}

function userSearchValid(user) {
	return user !== null && typeof user !== 'undefined';
}

function siteSearchValid(site) {
	return site !== null && typeof site !== 'undefined';
}

function storeSearchValid(store) {
	return store !== null && typeof store !== 'undefined';
}

function getExportHeaderSearchParams(exportHeader, closedOnly) {
	let filterExpression = "#customerId = :customerId";
	let expressionAttributeNames = "{\"#customerId\": \"customerId\"";
	let expressionAttributeValues = "{\":customerId\": \"" + exportHeader.customerId + "\"";

	//did the user give us valid store data?
	if (exportHeader.store !== null && typeof exportHeader.store !== 'undefined' && exportHeader.store.length > 0) {
		filterExpression += " and #store = :store";
		expressionAttributeNames += ",\"#store\": \"store\"";
		expressionAttributeValues += ",\":store\": \"" + exportHeader.store + "\"";
	}

	//did the user give us valid type data?
	if (exportHeader.type !== null && typeof exportHeader.type !== 'undefined' && exportHeader.type.length > 0 && exportHeader.type !== 'any') {
		filterExpression += " and #type = :type";
		expressionAttributeNames += ",\"#type\": \"type\"";
		expressionAttributeValues += ",\":type\": \"" + exportHeader.type + "\"";
	}

	//did the user give us valid date data?
	if (exportHeader.fromDate !== null && typeof exportHeader.fromDate !== 'undefined' && exportHeader.fromDate.length > 0 && exportHeader.toDate !== null && typeof exportHeader.toDate !== 'undefined' && exportHeader.toDate.length > 0) {
		filterExpression += " and #date BETWEEN :from AND :to";
		expressionAttributeNames += ",\"#date\": \"date\"";
		expressionAttributeValues += ",\":from\": \"" + exportHeader.fromDate + "\"";
		expressionAttributeValues += ",\":to\": \"" + exportHeader.toDate + "\"";
	}

	//are we searching for closed orders only?
	if (closedOnly) {
		filterExpression += " and #status = :status";
		expressionAttributeNames += ",\"#status\": \"status\"";
		expressionAttributeValues += ",\":status\": \"CLOSED\"";
	}

	expressionAttributeNames += "}";
	expressionAttributeValues += "}";

	const params = {
		TableName: process.env.DYNAMODB_EXPORT_HEADER_TABLE_NAME,
		FilterExpression: filterExpression,
		ExpressionAttributeNames: JSON.parse(expressionAttributeNames),
    	ExpressionAttributeValues: JSON.parse(expressionAttributeValues),
	};

	return params;
}

function getExportDetailSearchParams(exportHeader) {
	let filterExpression = "#customerId = :customerId";
	let expressionAttributeNames = "{\"#customerId\": \"customerId\"";
	let expressionAttributeValues = "{\":customerId\": \"" + exportHeader.customerId + "\"";

	//did the user give us valid store data?
	if (exportHeader.store !== null && typeof exportHeader.store !== 'undefined' && exportHeader.store.length > 0) {
		filterExpression += " and #store = :store";
		expressionAttributeNames += ",\"#store\": \"store\"";
		expressionAttributeValues += ",\":store\": \"" + exportHeader.store + "\"";
	}

	//did the user give us valid type data?
	if (exportHeader.type !== null && typeof exportHeader.type !== 'undefined' && exportHeader.type.length > 0 && exportHeader.type !== 'any') {
		filterExpression += " and #type = :type";
		expressionAttributeNames += ",\"#type\": \"type\"";
		expressionAttributeValues += ",\":type\": \"" + exportHeader.type + "\"";
	}

	//did the user give us valid date data?
	if (exportHeader.fromDate !== null && typeof exportHeader.fromDate !== 'undefined' && exportHeader.fromDate.length > 0 && exportHeader.toDate !== null && typeof exportHeader.toDate !== 'undefined' && exportHeader.toDate.length > 0) {
		filterExpression += " and #date BETWEEN :from AND :to";
		expressionAttributeNames += ",\"#date\": \"date\"";
		expressionAttributeValues += ",\":from\": \"" + exportHeader.fromDate + "\"";
		expressionAttributeValues += ",\":to\": \"" + exportHeader.toDate + "\"";
	}

	expressionAttributeNames += "}";
	expressionAttributeValues += "}";

	const params = {
		TableName: process.env.DYNAMODB_EXPORT_DETAIL_TABLE_NAME,
		FilterExpression: filterExpression,
		ExpressionAttributeNames: JSON.parse(expressionAttributeNames),
    	ExpressionAttributeValues: JSON.parse(expressionAttributeValues),
	};

	return params;
}

function getUserSearchParams(user, mobileUser) {
	let filterExpression = "#mobileUser = :mobileUser";
	let expressionAttributeNames = "{\"#mobileUser\": \"mobileUser\"";
	let expressionAttributeValues = "{\":mobileUser\": " + mobileUser;

	//did the user give us valid customer ID data?
	if (user.customerId !== null && typeof user.customerId !== 'undefined' && user.customerId.length > 0) {
		filterExpression += " and #customerId = :customerId";
		expressionAttributeNames += ",\"#customerId\": \"customer_id\"";
		expressionAttributeValues += ",\":customerId\": \"" + user.customerId + "\"";
	}

	//did the user give us valid username data?
	if (user.username !== null && typeof user.username !== 'undefined' && user.username.length > 0) {
		filterExpression += " and #username = :username";
		expressionAttributeNames += ",\"#username\": \"username\"";
		expressionAttributeValues += ",\":username\": \"" + user.username + "\"";
	}

	expressionAttributeNames += "}";
	expressionAttributeValues += "}";

	const params = {
		TableName: process.env.DYNAMODB_USER_TABLE_NAME,
		FilterExpression: filterExpression,
		ExpressionAttributeNames: JSON.parse(expressionAttributeNames),
    	ExpressionAttributeValues: JSON.parse(expressionAttributeValues),
	};

	return params;
}

function convertToBoolean(stringValue) {
	let b = false;

	if (stringValue !== null && typeof stringValue !== 'undefined') {
		const lowerCase = stringValue.toLowerCase();

		b = lowerCase === 'yes' || lowerCase ==='true';
	}

	return b;
}

function getSiteSearchParams(site) {
	let filterExpression = "";
	let expressionAttributeNames = "";
	let expressionAttributeValues = "";

	//did the user give us valid customer ID data?
	if (site.customerId !== null && typeof site.customerId !== 'undefined' && site.customerId.length > 0) {
		filterExpression += "#customerId = :customerId";
		expressionAttributeNames += "{\"#customerId\": \"customerId\"";
		expressionAttributeValues += "{\":customerId\": \"" + site.customerId + "\"";
	}

	if (expressionAttributeNames.length > 0) {
		expressionAttributeNames += "}";
	}
	
	if (expressionAttributeValues.length > 0) {
		expressionAttributeValues += "}";
	}

	let params;

	if (filterExpression.length > 0) {
		params = {
			TableName: process.env.DYNAMODB_SITE_TABLE_NAME,
			FilterExpression: filterExpression,
			ExpressionAttributeNames: JSON.parse(expressionAttributeNames),
    		ExpressionAttributeValues: JSON.parse(expressionAttributeValues),
		};
	} else {
		params = {
			TableName: process.env.DYNAMODB_SITE_TABLE_NAME,
		};
	}

	return params;
}

function getStoreSearchParams(store) {
	let filterExpression = "";
	let expressionAttributeNames = "";
	let expressionAttributeValues = "";

	//did the user give us valid customer ID data?
	if (store.storeIdentifier !== null && typeof store.storeIdentifier !== 'undefined' && store.storeIdentifier.length > 0) {
		filterExpression += "#storeIdentifier = :storeIdentifier";
		expressionAttributeNames += "{\"#storeIdentifier\": \"storeIdentifier\"";
		expressionAttributeValues += "{\":storeIdentifier\": \"" + store.storeIdentifier + "\"";
	}

	if (expressionAttributeNames.length > 0) {
		expressionAttributeNames += "}";
	}
	
	if (expressionAttributeValues.length > 0) {
		expressionAttributeValues += "}";
	}

	let params;

	if (filterExpression.length > 0) {
		params = {
			TableName: process.env.DYNAMODB_STORE_TABLE_NAME,
			FilterExpression: filterExpression,
			ExpressionAttributeNames: JSON.parse(expressionAttributeNames),
    		ExpressionAttributeValues: JSON.parse(expressionAttributeValues),
		};
	} else {
		params = {
			TableName: process.env.DYNAMODB_STORE_TABLE_NAME,
		};
	}

	return params;
}

function userValid(user) {
	let valid = false;

	if (user !== null && typeof user !== 'undefined') {
		valid = user.customerId !== null && typeof user.customerId !== 'undefined' && user.customerId.length > 0
		&& user.username !== null && typeof user.username !== 'undefined' && user.username.length > 0
		&& user.password !== null && typeof user.password !== 'undefined' && user.password.length > 0
		&& user.active !== null && typeof user.active !== 'undefined'
		&& user.language !== null && typeof user.language !== 'undefined' && user.language.length > 0;
	}

	return valid;
}

function storeValid(store) {
	let valid = false;

	if (store !== null && typeof store !== 'undefined') {
		valid = store.storeIdentifier !== null && typeof store.storeIdentifier !== 'undefined' && store.storeIdentifier.length === 6
		&& store.storeName !== null && typeof store.storeName !== 'undefined' && store.storeName.length > 0;
	}

	return valid;
}

function systemLogSearchValid(systemLog) {
	return systemLog !== null && typeof systemLog !== 'undefined';
}

function orderSearchValid(order) {
	return order !== null && typeof order !== 'undefined';
}

function getSystemLogSearchParams(systemLog) {
	let filterExpression = "";
	let expressionAttributeNames = "";
	let expressionAttributeValues = "";

	//did the user give us valid customer ID data?
	if (systemLog.businessUnit !== null && typeof systemLog.businessUnit !== 'undefined' && systemLog.businessUnit.length > 0) {
		filterExpression += "#businessUnit = :businessUnit";
		expressionAttributeNames += "{\"#businessUnit\": \"businessUnit\"";
		expressionAttributeValues += "{\":businessUnit\": \"" + systemLog.businessUnit + "\"";
	}

	if (expressionAttributeNames.length > 0) {
		expressionAttributeNames += "}";
	}
	
	if (expressionAttributeValues.length > 0) {
		expressionAttributeValues += "}";
	}

	let params;

	if (filterExpression.length > 0) {
		params = {
			TableName: process.env.DYNAMODB_SYSTEM_LOG_TABLE_NAME,
			FilterExpression: filterExpression,
			ExpressionAttributeNames: JSON.parse(expressionAttributeNames),
    		ExpressionAttributeValues: JSON.parse(expressionAttributeValues),
		};
	} else {
		params = {
			TableName: process.env.DYNAMODB_SYSTEM_LOG_TABLE_NAME,
		};
	}

	return params;
}

function getOrderSearchParams(order) {
	let filterExpression = "";
	let expressionAttributeNames = "";
	let expressionAttributeValues = "";

	//did the user give us valid order number data?
	if (order.orderNumber !== null && typeof order.orderNumber !== 'undefined' && order.orderNumber.length > 0) {
		filterExpression += "#orderNumber = :orderNumber";
		expressionAttributeNames += "{\"#orderNumber\": \"orderNumber\"";
		expressionAttributeValues += "{\":orderNumber\": \"" + order.orderNumber + "\"";
	}

	//did the user give us valid season data?
	if (order.season !== null && typeof order.season !== 'undefined' && order.season.length > 0) {
		if (filterExpression.length === 0) {
			filterExpression += "#season = :season";
			expressionAttributeNames += "{\"#season\": \"season\"";
			expressionAttributeValues += "{\":season\": \"" + order.season + "\"";
		} else {
			filterExpression += " and #season = :season";
			expressionAttributeNames += ",\"#season\": \"season\"";
			expressionAttributeValues += ",\":season\": \"" + order.season + "\"";
		}
	}

	//did the user give us valid supplier code data?
	if (order.supplierCode !== null && typeof order.supplierCode !== 'undefined' && order.supplierCode.length > 0) {
		if (filterExpression.length === 0) {
			filterExpression += "#customerId = :customerId";
			expressionAttributeNames += "{\"#customerId\": \"customerId\"";
			expressionAttributeValues += "{\":customerId\": \"" + order.supplierCode + "\"";
		} else {
			filterExpression += " and #customerId = :customerId";
			expressionAttributeNames += ",\"#customerId\": \"customerId\"";
			expressionAttributeValues += ",\":customerId\": \"" + order.supplierCode + "\"";
		}
	}

	//did the user give us valid order status data?
	if (order.orderStatus !== null && typeof order.orderStatus !== 'undefined' && order.orderStatus.length > 0 && order.orderStatus.toUpperCase() !== 'ALL') {
		if (filterExpression.length === 0) {
			filterExpression += "#orderStatus = :orderStatus";
			expressionAttributeNames += "{\"#orderStatus\": \"orderStatus\"";
			expressionAttributeValues += "{\":orderStatus\": \"" + order.orderStatus.toUpperCase() + "\"";
		} else {
			filterExpression += " and #orderStatus = :orderStatus";
			expressionAttributeNames += ",\"#orderStatus\": \"orderStatus\"";
			expressionAttributeValues += ",\":orderStatus\": \"" + order.orderStatus.toUpperCase() + "\"";
		}
	}

	if (expressionAttributeNames.length > 0) {
		expressionAttributeNames += "}";
	}
	
	if (expressionAttributeValues.length > 0) {
		expressionAttributeValues += "}";
	}

	let params;

	if (filterExpression.length > 0) {
		params = {
			TableName: process.env.DYNAMODB_ORDER_HEADER_TABLE_NAME,
			FilterExpression: filterExpression,
			ExpressionAttributeNames: JSON.parse(expressionAttributeNames),
    		ExpressionAttributeValues: JSON.parse(expressionAttributeValues),
		};
	} else {
		params = {
			TableName: process.env.DYNAMODB_ORDER_HEADER_TABLE_NAME,
		};
	}

	return params;
}

//custom render classes, variables & methods
class RenderObj {
	constructor(callerId, username, customerId, status, statusColour, additionalInfo, req, res) {
		this.callerId = callerId;
		this.username = username;
		this.customerId = customerId;
		this.status = status;
		this.statusColour = statusColour;
		this.additionalInfo = additionalInfo;
		this.req = req;
		this.res = res;
	}
}

const viewOrderStatusId = 1;
const viewOrderStatus2Id = 2;
const viewScansId = 3;
const viewScans2Id = 4;
const viewExportStatusId = 5;
const viewExportStatus2Id = 6;
const viewExportScansId = 7;
const viewExportScans2Id = 8;
const viewClosedOrdersId = 9;
const viewClosedOrders2Id = 10;
const viewClosedOrders1Id = 11;
const viewClosedOrders12Id = 12;
const viewAllUsersId = 13;
const viewAllUsers2Id = 14;
const viewAllMobileUsersId = 15;
const viewAllMobileUsers2Id = 16;
const viewAllSitesId = 17;
const viewAllSites2Id = 18;
const viewAllStoresId = 19;
const viewAllStores2Id = 20;
const systemLogId = 21;
const systemLog2Id = 22;
const extractedOrdersId = 23;
const extractedOrders2Id = 24;

function renderViewOrderStatus2(renderObj) {
	if (orderHeaderSearchValid(renderObj.additionalInfo)) {
		dynamoDb.scan(getOrderHeaderSearchParams(renderObj.additionalInfo, false), (error, result) => {
			if (error) {
        		console.error(error);

        		//flash error
        		if (renderObj.callerId === viewOrderStatusId) {
        			renderObj.res.render("view-order-status", {
        				username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
        			});
        		} else if (renderObj.callerId === viewOrderStatus2Id) {
        			renderObj.res.render("view-order-status_2", {
						username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
						items: [],
						orderHeader: renderObj.additionalInfo,
					});
        		}
    		} else {
    			let pos = result.Items.length;
    			finaliseViewOrderStatus2(renderObj, result.Items, pos);
    		}
		});
	} else {
		if (renderObj.callerId === viewOrderStatusId) {
			renderObj.res.render("view-order-status", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
			});
		} else if (renderObj.callerId === viewOrderStatus2Id) {
			renderObj.res.render("view-order-status_2", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
				items: [],
				orderHeader: renderObj.additionalInfo,
			});
		}
	}
}

function finaliseViewOrderStatus2(renderObj, items, pos) {
	if (pos === 0) {
		//done
		//go to the next stage
		renderObj.res.render("view-order-status_2", {
			username: renderObj.username,
			customerId: renderObj.customerId,
			status: renderObj.status,
			statusColour: renderObj.statusColour,
			items: items,
			orderHeader: renderObj.additionalInfo,
		});
	} else {
		--pos;

		//create params
        const params = {
        	TableName: process.env.DYNAMODB_ORDER_DETAIL_TABLE_NAME,
        	FilterExpression: "#customerId = :customerId AND #orderNumber = :orderNumber AND #season = :season",
    		ExpressionAttributeNames: {
            	"#customerId": "customerId",
            	"#orderNumber": "orderNumber",
            	"#season": "season",
        	},
        	ExpressionAttributeValues: {
            	":customerId": items[pos].customerId,
            	":orderNumber": items[pos].orderNumber,
            	":season": items[pos].season,
        	},
        };

        dynamoDb.scan(params, (error, result) => {
        	if (error) {
        		console.error(error);

        		//cannot determine left outstanding, set to required items amount
        		items[pos].leftOutstanding = items[pos].requiredItems;
        	} else {
        		let requiredItems = items[pos].requiredItems;
        		let detailsSoFar = result.Count;

        		//can determine left outstanding
        		items[pos].leftOutstanding = requiredItems - detailsSoFar;
        	}

        	//run this method again (recursive)
        	finaliseViewOrderStatus2(renderObj, items, pos);
        });
	}
}

function renderViewScans2(renderObj) {
	if (orderHeaderSearchValid(renderObj.additionalInfo)) {
		dynamoDb.scan(getOrderDetailSearchParams(renderObj.additionalInfo), (error, result) => {
			if (error) {
        		console.error(error);

        		//flash error
        		if (renderObj.callerId === viewScansId) {
        			renderObj.res.render("view-scans", {
        				username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
        			});
        		} else if (renderObj.callerId === viewScans2Id) {
        			renderObj.res.render("view-scans_2", {
						username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
						items: [],
						orderHeader: renderObj.additionalInfo,
					});
        		}
    		} else {
    			//go to the next stage
    			renderObj.res.render("view-scans_2", {
    				username: renderObj.username,
					customerId: renderObj.customerId,
					status: renderObj.status,
					statusColour: renderObj.statusColour,
					items: result.Items,
					orderHeader: renderObj.additionalInfo,
    			});
    		}
		});
	} else {
		if (renderObj.callerId === viewScansId) {
			renderObj.res.render("view-scans", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
			});
		} else if (renderObj.callerId === viewScans2Id) {
			renderObj.res.render("view-scans_2", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
				items: [],
				orderHeader: renderObj.additionalInfo,
			});
		}
	}
}

function renderViewExportStatus2(renderObj) {
	if (exportHeaderSearchValid(renderObj.additionalInfo)) {
		dynamoDb.scan(getExportHeaderSearchParams(renderObj.additionalInfo, false), (error, result) => {
			if (error) {
        		console.error(error);

        		//flash error
        		if (renderObj.callerId === viewExportStatusId) {
        			renderObj.res.render("view-export-status", {
        				username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
        			});
        		} else if (renderObj.callerId === viewExportStatus2Id) {
        			renderObj.res.render("view-export-status_2", {
						username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
						items: [],
						exportHeader: renderObj.additionalInfo,
					});
        		}
    		} else {
    			//go to the next stage
    			renderObj.res.render("view-export-status_2", {
    				username: renderObj.username,
					customerId: renderObj.customerId,
					status: renderObj.status,
					statusColour: renderObj.statusColour,
					items: result.Items,
					exportHeader: renderObj.additionalInfo,
    			});
    		}
		});
	} else {
		if (renderObj.callerId === viewExportStatusId) {
			renderObj.res.render("view-export-status", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
			});
		} else if (renderObj.callerId === viewExportStatus2Id) {
			renderObj.res.render("view-export-status_2", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
				items: [],
				exportHeader: renderObj.additionalInfo,
			});
		}
	}
}

function renderViewExportScans2(renderObj) {
	if (exportHeaderSearchValid(renderObj.additionalInfo)) {
		dynamoDb.scan(getExportDetailSearchParams(renderObj.additionalInfo), (error, result) => {
			if (error) {
        		console.error(error);

        		//flash error
        		if (renderObj.callerId === viewExportScansId) {
        			renderObj.res.render("view-export-scans", {
        				username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
        			});
        		} else if (renderObj.callerId === viewExportScans2Id) {
        			renderObj.res.render("view-export-scans_2", {
						username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
						items: [],
						exportHeader: renderObj.additionalInfo,
					});
        		}
    		} else {
    			//go to the next stage
    			renderObj.res.render("view-export-scans_2", {
    				username: renderObj.username,
					customerId: renderObj.customerId,
					status: renderObj.status,
					statusColour: renderObj.statusColour,
					items: result.Items,
					exportHeader: renderObj.additionalInfo,
    			});
    		}
		});
	} else {
		if (renderObj.callerId === viewExportScansId) {
			renderObj.res.render("view-export-scans", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
			});
		} else if (renderObj.callerId === viewExportScans2Id) {
			renderObj.res.render("view-export-scans_2", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
				items: [],
				exportHeader: renderObj.additionalInfo,
			});
		}
	}
}

function renderViewClosedOrders2(renderObj) {
	if (strictOrderHeaderSearchValid(renderObj.additionalInfo)) {
		dynamoDb.scan(getOrderHeaderSearchParams(renderObj.additionalInfo, true), (error, result) => {
			if (error) {
				console.error(error);

				//flash error
        		if (renderObj.callerId === viewClosedOrdersId) {
        			renderObj.res.render("view-closed-orders", {
        				username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
        			});
        		} else if (renderObj.callerId === viewClosedOrders2Id) {
        			renderObj.res.render("view-closed-orders_2", {
						username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
						items: [],
						orderHeader: renderObj.additionalInfo,
					});
        		}
			} else {
				//is it a closed order?
				if (result.Count > 0) {
					dynamoDb.scan(getOrderDetailSearchParams(renderObj.additionalInfo), (error, result) => {
						if (error) {
        					console.error(error);

	        				//flash error
    	    				if (renderObj.callerId === viewClosedOrdersId) {
        						renderObj.res.render("view-closed-orders", {
        							username: renderObj.username,
									customerId: renderObj.customerId,
									status: "Error searching db.",
									statusColour: "red",
        						});
        					} else if (renderObj.callerId === viewClosedOrders2Id) {
	        					renderObj.res.render("view-closed-orders_2", {
									username: renderObj.username,
									customerId: renderObj.customerId,
									status: "Error searching db.",
									statusColour: "red",
									items: [],
									orderHeader: renderObj.additionalInfo,
								});
        					}
    					} else {
    						//go to the next stage
    						renderObj.res.render("view-closed-orders_2", {
    							username: renderObj.username,
								customerId: renderObj.customerId,
								status: renderObj.status,
								statusColour: renderObj.statusColour,
								items: result.Items,
								orderHeader: renderObj.additionalInfo,
    						});
    					}
					});
				} else {
					if (renderObj.callerId === viewClosedOrdersId) {
						renderObj.res.render("view-closed-orders", {
							username: renderObj.username,
							customerId: renderObj.customerId,
							status: "Order is not closed, no records found.",
							statusColour: "red",
						});
					} else if (renderObj.callerId === viewClosedOrders2Id) {
						renderObj.res.render("view-closed-orders_2", {
							username: renderObj.username,
							customerId: renderObj.customerId,
							status: "Order is not closed, no records found.",
							statusColour: "red",
							items: [],
							orderHeader: renderObj.additionalInfo,
						});
					}
				}
    		}
		});
	} else {
		if (renderObj.callerId === viewClosedOrdersId) {
			renderObj.res.render("view-closed-orders", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
			});
		} else if (renderObj.callerId === viewClosedOrders2Id) {
			renderObj.res.render("view-closed-orders_2", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
				items: [],
				orderHeader: renderObj.additionalInfo,
			});
		}
	}
}

function renderViewClosedOrders12(renderObj) {
	if (exportHeaderSearchValid(renderObj.additionalInfo)) {
		dynamoDb.scan(getExportHeaderSearchParams(renderObj.additionalInfo, true), (error, result) => {
			if (error) {
				console.error(error);

				//flash error
        		if (renderObj.callerId === viewClosedOrders1Id) {
        			renderObj.res.render("view-closed-orders1", {
        				username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
        			});
        		} else if (renderObj.callerId === viewClosedOrders12Id) {
        			renderObj.res.render("view-closed-orders1_2", {
						username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
						items: [],
						exportHeader: renderObj.additionalInfo,
					});
        		}
			} else {
				//is it a closed order?
				if (result.Count > 0) {
					dynamoDb.scan(getExportDetailSearchParams(renderObj.additionalInfo), (error, result) => {
						if (error) {
        					console.error(error);

	        				//flash error
    	    				if (renderObj.callerId === viewClosedOrders1Id) {
        						renderObj.res.render("view-closed-orders1", {
        							username: renderObj.username,
									customerId: renderObj.customerId,
									status: "Error searching db.",
									statusColour: "red",
        						});
        					} else if (renderObj.callerId === viewClosedOrders12Id) {
	        					renderObj.res.render("view-closed-orders1_2", {
									username: renderObj.username,
									customerId: renderObj.customerId,
									status: "Error searching db.",
									statusColour: "red",
									items: [],
									exportHeader: renderObj.additionalInfo,
								});
        					}
    					} else {
    						//go to the next stage
    						renderObj.res.render("view-closed-orders1_2", {
    							username: renderObj.username,
								customerId: renderObj.customerId,
								status: renderObj.status,
								statusColour: renderObj.statusColour,
								items: result.Items,
								exportHeader: renderObj.additionalInfo,
    						});
    					}
					});
				} else {
					if (renderObj.callerId === viewClosedOrders1Id) {
						renderObj.res.render("view-closed-orders1", {
							username: renderObj.username,
							customerId: renderObj.customerId,
							status: "Export is not closed, no records found.",
							statusColour: "red",
						});
					} else if (renderObj.callerId === viewClosedOrders12Id) {
						renderObj.res.render("view-closed-orders1_2", {
							username: renderObj.username,
							customerId: renderObj.customerId,
							status: "Export is not closed, no records found.",
							statusColour: "red",
							items: [],
							exportHeader: renderObj.additionalInfo,
						});
					}
				}
    		}
		});
	} else {
		if (renderObj.callerId === viewClosedOrders1Id) {
			renderObj.res.render("view-closed-orders1", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
			});
		} else if (renderObj.callerId === viewClosedOrders12Id) {
			renderObj.res.render("view-closed-orders1_2", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
				items: [],
				exportHeader: renderObj.additionalInfo,
			});
		}
	}
}

function renderViewAllUsers2(renderObj) {
	if (userSearchValid(renderObj.additionalInfo)) {
		dynamoDb.scan(getUserSearchParams(renderObj.additionalInfo, false), (error, result) => {
			if (error) {
        		console.error(error);

        		//flash error
        		if (renderObj.callerId === viewAllUsersId) {
        			renderObj.res.render("view-all-users", {
        				username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
        			});
        		} else if (renderObj.callerId === viewAllUsers2Id) {
        			renderObj.res.render("view-all-users_2", {
						username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
						items: [],
						user: renderObj.additionalInfo,
					});
        		}
    		} else {
    			//go to the next stage
    			renderObj.res.render("view-all-users_2", {
    				username: renderObj.username,
					customerId: renderObj.customerId,
					status: renderObj.status,
					statusColour: renderObj.statusColour,
					items: result.Items,
					user: renderObj.additionalInfo,
    			});
    		}
		});
	} else {
		if (renderObj.callerId === viewAllUsersId) {
			renderObj.res.render("view-all-users", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
			});
		} else if (renderObj.callerId === viewAllUsers2Id) {
			renderObj.res.render("view-all-users_2", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
				items: [],
				user: renderObj.additionalInfo,
			});
		}
	}
}

function renderViewAllMobileUsers2(renderObj) {
	if (userSearchValid(renderObj.additionalInfo)) {
		dynamoDb.scan(getUserSearchParams(renderObj.additionalInfo, true), (error, result) => {
			if (error) {
        		console.error(error);

        		//flash error
        		if (renderObj.callerId === viewAllMobileUsersId) {
        			renderObj.res.render("view-all-users", {
        				username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
        			});
        		} else if (renderObj.callerId === viewAllMobileUsers2Id) {
        			renderObj.res.render("view-all-mobile-users_2", {
						username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
						items: [],
						user: renderObj.additionalInfo,
					});
        		}
    		} else {
    			//go to the next stage
    			renderObj.res.render("view-all-mobile-users_2", {
    				username: renderObj.username,
					customerId: renderObj.customerId,
					status: renderObj.status,
					statusColour: renderObj.statusColour,
					items: result.Items,
					user: renderObj.additionalInfo,
    			});
    		}
		});
	} else {
		if (renderObj.callerId === viewAllMobileUsersId) {
			renderObj.res.render("view-all-users", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
			});
		} else if (renderObj.callerId === viewAllMobileUsers2Id) {
			renderObj.res.render("view-all-mobile-users_2", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
				items: [],
				user: renderObj.additionalInfo,
			});
		}
	}
}

function renderViewAllSites2(renderObj) {
	if (siteSearchValid(renderObj.additionalInfo)) {
		dynamoDb.scan(getSiteSearchParams(renderObj.additionalInfo), (error, result) => {
			if (error) {
        		console.error(error);

        		//flash error
        		if (renderObj.callerId === viewAllSitesId) {
        			renderObj.res.render("view-all-sites", {
        				username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
        			});
        		} else if (renderObj.callerId === viewAllSites2Id) {
        			renderObj.res.render("view-all-sites_2", {
						username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
						items: [],
						site: renderObj.additionalInfo,
					});
        		}
    		} else {
    			//go to the next stage
    			renderObj.res.render("view-all-sites_2", {
    				username: renderObj.username,
					customerId: renderObj.customerId,
					status: renderObj.status,
					statusColour: renderObj.statusColour,
					items: result.Items,
					site: renderObj.additionalInfo,
    			});
    		}
		});
	} else {
		if (renderObj.callerId === viewAllSitesId) {
			renderObj.res.render("view-all-sites", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
			});
		} else if (renderObj.callerId === viewAllSites2Id) {
			renderObj.res.render("view-all-sites_2", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
				items: [],
				site: renderObj.additionalInfo,
			});
		}
	}
}

function renderViewAllStores2(renderObj) {
	if (storeSearchValid(renderObj.additionalInfo)) {
		dynamoDb.scan(getStoreSearchParams(renderObj.additionalInfo), (error, result) => {
			if (error) {
        		console.error(error);

        		//flash error
        		if (renderObj.callerId === viewAllStoresId) {
        			renderObj.res.render("view-all-stores", {
        				username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
        			});
        		} else if (renderObj.callerId === viewAllStores2Id) {
        			renderObj.res.render("view-all-stores_2", {
						username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
						items: [],
						store: renderObj.additionalInfo,
					});
        		}
    		} else {
    			//go to the next stage
    			renderObj.res.render("view-all-stores_2", {
    				username: renderObj.username,
					customerId: renderObj.customerId,
					status: renderObj.status,
					statusColour: renderObj.statusColour,
					items: result.Items,
					store: renderObj.additionalInfo,
    			});
    		}
		});
	} else {
		if (renderObj.callerId === viewAllStoresId) {
			renderObj.res.render("view-all-stores", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
			});
		} else if (renderObj.callerId === viewAllStores2Id) {
			renderObj.res.render("view-all-stores_2", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
				items: [],
				store: renderObj.additionalInfo,
			});
		}
	}
}

function renderSystemLog2(renderObj) {
	if (systemLogSearchValid(renderObj.additionalInfo)) {
		dynamoDb.scan(getSystemLogSearchParams(renderObj.additionalInfo), (error, result) => {
			if (error) {
        		console.error(error);

        		//flash error
        		if (renderObj.callerId === systemLogId) {
        			renderObj.res.render("system-log", {
        				username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
        			});
        		} else if (renderObj.callerId === systemLog2Id) {
        			renderObj.res.render("system-log_2", {
						username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
						items: [],
						systemLog: renderObj.additionalInfo,
					});
        		}
    		} else {
    			//go to the next stage
    			renderObj.res.render("system-log_2", {
    				username: renderObj.username,
					customerId: renderObj.customerId,
					status: renderObj.status,
					statusColour: renderObj.statusColour,
					items: result.Items,
					systemLog: renderObj.additionalInfo,
    			});
    		}
		});
	} else {
		if (renderObj.callerId === systemLogId) {
			renderObj.res.render("system-log", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
			});
		} else if (renderObj.callerId === systemLog2Id) {
			renderObj.res.render("system-log_2", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
				items: [],
				systemLog: renderObj.additionalInfo,
			});
		}
	}
}

function renderExtractedOrders2(renderObj) {
	if (orderSearchValid(renderObj.additionalInfo)) {
		dynamoDb.scan(getOrderSearchParams(renderObj.additionalInfo), (error, result) => {
			if (error) {
        		console.error(error);

        		//flash error
        		if (renderObj.callerId === extractedOrdersId) {
        			renderObj.res.render("extracted-orders", {
        				username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
        			});
        		} else if (renderObj.callerId === extractedOrders2Id) {
        			renderObj.res.render("extracted-orders_2", {
						username: renderObj.username,
						customerId: renderObj.customerId,
						status: "Error searching db.",
						statusColour: "red",
						items: [],
						order: renderObj.additionalInfo,
					});
        		}
    		} else {
    			let pos = result.Items.length;
    			finaliseExtractedOrders2(renderObj, result.Items, pos);
    		}
		});
	} else {
		if (renderObj.callerId === extractedOrdersId) {
			renderObj.res.render("extracted-orders", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
			});
		} else if (renderObj.callerId === extractedOrders2Id) {
			renderObj.res.render("extracted-orders_2", {
				username: renderObj.username,
				customerId: renderObj.customerId,
				status: "Values in one or more fields are invalid.",
				statusColour: "red",
				items: [],
				order: renderObj.additionalInfo,
			});
		}
	}
}

function finaliseExtractedOrders2(renderObj, items, pos) {
	if (pos === 0) {
		//done
		//go to the next stage
		renderObj.res.render("extracted-orders_2", {
			username: renderObj.username,
			customerId: renderObj.customerId,
			status: renderObj.status,
			statusColour: renderObj.statusColour,
			items: items,
			order: renderObj.additionalInfo,
		});
	} else {
		--pos;

		//create params
        const params = {
        	TableName: process.env.DYNAMODB_ORDER_DETAIL_TABLE_NAME,
        	FilterExpression: "#customerId = :customerId AND #orderNumber = :orderNumber AND #season = :season",
    		ExpressionAttributeNames: {
            	"#customerId": "customerId",
            	"#orderNumber": "orderNumber",
            	"#season": "season",
        	},
        	ExpressionAttributeValues: {
            	":customerId": items[pos].customerId,
            	":orderNumber": items[pos].orderNumber,
            	":season": items[pos].season,
        	},
        };

        dynamoDb.scan(params, (error, result) => {
        	if (error) {
        		console.error(error);

        		//cannot determine awaiting scan, set to required items amount
        		items[pos].awaitingScan = items[pos].requiredItems;
        	} else {
        		let requiredItems = items[pos].requiredItems;
        		let detailsSoFar = result.Count;

        		//can determine left outstanding
        		items[pos].awaitingScan = requiredItems - detailsSoFar;
        	}

        	//run this method again (recursive)
        	finaliseExtractedOrders2(renderObj, items, pos);
        });
	}
}

//GET routes
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
		res.render("initiate-purchase-order", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-order-status.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		res.render("view-order-status", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-order-status_2.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		const orderHeader = {
			customerId: req.user.customer_id,
			orderNumber: req.query.orderNumber,
			season: req.query.season,
		};

		renderViewOrderStatus2(new RenderObj(viewOrderStatus2Id, req.user.username, orderHeader.customerId, "", "", orderHeader, req, res));
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-scans.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		res.render("view-scans", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-scans_2.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		const orderHeader = {
			customerId: req.user.customer_id,
			orderNumber: req.query.orderNumber,
			season: req.query.season,
		};

		renderViewScans2(new RenderObj(viewScans2Id, req.user.username, orderHeader.customerId, "", "", orderHeader, req, res));
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-export-status.html", function(req, res) {
	//is user logged in as an export user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("Export")) {
		res.render("view-export-status", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-export-status_2.html", function(req, res) {
	//is user logged in as an export user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("Export")) {
		const exportHeader = {
			customerId: req.user.customer_id,
			store: req.query.store,
			fromDate: req.query.fromDate,
			toDate: req.query.toDate,
			type: req.query.type,
		};

		renderViewExportStatus2(new RenderObj(viewExportStatus2Id, req.user.username, exportHeader.customerId, "", "", exportHeader, req, res));
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-export-scans.html", function(req, res) {
	//is user logged in as an export user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("Export")) {
		res.render("view-export-scans", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-export-scans_2.html", function(req, res) {
	//is user logged in as an export user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("Export")) {
		const exportHeader = {
			customerId: req.user.customer_id,
			store: req.query.store,
			fromDate: req.query.fromDate,
			toDate: req.query.toDate,
			type: req.query.type,
		};

		renderViewExportScans2(new RenderObj(viewExportScans2Id, req.user.username, exportHeader.customerId, "", "", exportHeader, req, res));
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-closed-orders.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		res.render("view-closed-orders", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-closed-orders_2.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		const orderHeader = {
			customerId: req.user.customer_id,
			orderNumber: req.query.orderNumber,
			season: req.query.season,
		};

		renderViewClosedOrders2(new RenderObj(viewClosedOrders2Id, req.user.username, orderHeader.customerId, "", "", orderHeader, req, res));
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-closed-orders1.html", function(req, res) {
	//is user logged in as an export user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("Export")) {
		res.render("view-closed-orders1", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-closed-orders1_2.html", function(req, res) {
	//is user logged in?
	if (req.isAuthenticated()) {
		const exportHeader = {
			customerId: req.user.customer_id,
			store: req.query.store,
			fromDate: req.query.fromDate,
			toDate: req.query.toDate,
			type: req.query.type,
		};

		renderViewClosedOrders12(new RenderObj(viewClosedOrders12Id, req.user.username, exportHeader.customerId, "", "", exportHeader, req, res));
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-all-users.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		res.render("view-all-users", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-all-users_2.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		const user = {
			customerId: req.query.customerId,
			username: req.query.username,
		};

		renderViewAllUsers2(new RenderObj(viewAllUsers2Id, req.user.username, req.user.customer_id, "", "", user, req, res));
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-all-mobile-users_2.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		const user = {
			customerId: req.query.customerId,
		};

		renderViewAllMobileUsers2(new RenderObj(viewAllMobileUsers2Id, req.user.username, req.user.customer_id, "", "", user, req, res));
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-all-sites.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		res.render("view-all-sites", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-all-sites_2.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		const site = {
			customerId: req.query.customerId,
		};

		renderViewAllSites2(new RenderObj(viewAllSites2Id, req.user.username, req.user.customer_id, "", "", site, req, res));
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-all-stores.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		res.render("view-all-stores", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/view-all-stores_2.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		const store = {
			storeIdentifier: req.query.storeIdentifier,
		};

		renderViewAllStores2(new RenderObj(viewAllStores2Id, req.user.username, req.user.customer_id, "", "", store, req, res));
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/add-supplier.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		res.render("add-supplier", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/add-exporter.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		res.render("add-exporter", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/add-store.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		res.render("add-store", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/system-log.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		res.render("system-log", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/system-log_2.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		const systemLog = {
			businessUnit: req.query.businessUnit,
		};

		renderSystemLog2(new RenderObj(systemLog2Id, req.user.username, req.user.customer_id, "", "", systemLog, req, res));
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/extracted-orders.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		res.render("extracted-orders", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "",
			statusColour: "",
		});
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

app.get("/extracted-orders_2.html", function(req, res) {
	//is user logged in as an admin user?
	if (req.isAuthenticated() && propertyValid(req.user.role) && req.user.role.includes("HM.Admin")) {
		const order = {
			orderNumber: req.query.orderNumber,
			season: req.query.season,
			supplierCode: req.query.supplierCode,
			orderStatus: req.query.orderStatus,
		};

		renderExtractedOrders2(new RenderObj(extractedOrders2Id, req.user.username, req.user.customer_id, "", "", order, req, res));
	} else {
		res.sendFile(__dirname + "/login.html");
	}
});

//POST routes
app.post("/login.html", function(req, res) {
	passport.authenticate("local")(req, res, function() {
		res.redirect(req.headers.referer);
	});
});

app.post("/initiate-purchase-order.html", function(req, res) {
	const orderHeader = {
		customerId: req.user.customer_id,
		orderNumber: req.body.orderNumber,
		ss: req.body.ss,
		yyyy: req.body.yyyy,
		orderStatus: 'OPEN',
		itemCountRequired: req.body.itemCountRequired,
		exported: false,
	};

	//are all required variables defined?
	if (orderHeaderValid(orderHeader)) {
		const params = {
        	TableName: process.env.DYNAMODB_ORDER_HEADER_TABLE_NAME,
        	Item: {
            	id: uuid.v1(),
            	customerId: orderHeader.customerId,
            	orderNumber: orderHeader.orderNumber,
            	season: orderHeader.yyyy + orderHeader.ss,
            	orderStatus: orderHeader.orderStatus,
            	requiredItems: orderHeader.itemCountRequired,
            	exported: orderHeader.exported,
        	},
    	};

    	dynamoDb.put(params, (error) => {
    		if (error) {
            	console.error(error);
            	//flash error
            	res.render("initiate-purchase-order", {
					username: req.user.username,
					customerId: req.user.customer_id,
					status: "Error inserting into db.",
					statusColour: "red",
				});
        	} else {
        		//flash success
        		res.render("initiate-purchase-order", {
					username: req.user.username,
					customerId: req.user.customer_id,
					status: "Your submission was successful.",
					statusColour: "green",
				});
        	}
    	});
	} else {
		//flash error
		res.render("initiate-purchase-order", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/view-order-status.html", function(req, res) {
	const orderHeader = {
		customerId: req.user.customer_id,
		orderNumber: req.body.orderNumber,
		season: req.body.season,
	};

	//are all required variables defined?
	if (orderHeaderSearchValid(orderHeader)) {
		res.redirect("/view-order-status_2.html?orderNumber=" + orderHeader.orderNumber
			+ "&season=" + orderHeader.season);
	} else {
		//flash error
		res.render("view-order-status", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/view-order-status_2.html/del", function(req, res) {
	const orderHeader = {
		customerId: req.user.customer_id,
		orderNumber: req.query.orderNumber,
		season: req.query.season,
	};

	const id = req.query.id;

	if (propertyValid(id)) {
		const params = {
        	TableName: process.env.DYNAMODB_ORDER_HEADER_TABLE_NAME,
        	Key: {
            	id: id,
        	},
    	};

    	dynamoDb.delete(params, (error, result) => {
    		if (error) {
    			console.error(error);

    			renderViewOrderStatus2(new RenderObj(viewOrderStatus2Id, req.user.username, orderHeader.customerId, "Unable to delete record.", "red", orderHeader, req, res));
    		} else {
    			renderViewOrderStatus2(new RenderObj(viewOrderStatus2Id, req.user.username, orderHeader.customerId, "Record successfully deleted.", "green", orderHeader, req, res));
    		}
    	});
	} else {
		renderViewOrderStatus2(new RenderObj(viewOrderStatus2Id, req.user.username, orderHeader.customerId, "Cannot determine selected record.", "red", orderHeader, req, res));
	}
});

app.post("/view-order-status_2.html/edit", function(req, res) {
	const editableId = req.query.id;

	const orderHeader = {
		customerId: req.user.customer_id,
		orderNumber: req.query.orderNumber,
		season: req.query.season,
		editableId: editableId,
	};

	if (propertyValid(editableId)) {
		renderViewOrderStatus2(new RenderObj(viewOrderStatus2Id, req.user.username, orderHeader.customerId, "", "", orderHeader, req, res));
	} else {
		renderViewOrderStatus2(new RenderObj(viewOrderStatus2Id, req.user.username, orderHeader.customerId, "Cannot determine selected record.", "red", orderHeader, req, res));
	}
});

app.post("/view-order-status_2.html/cancel", function(req, res) {
	const orderHeader = {
		customerId: req.user.customer_id,
		orderNumber: req.query.orderNumber,
		season: req.query.season,
	};

	renderViewOrderStatus2(new RenderObj(viewOrderStatus2Id, req.user.username, orderHeader.customerId, "", "", orderHeader, req, res));
});

app.post("/view-order-status_2.html/put", function(req, res) {
	const orderHeader = {
		customerId: req.user.customer_id,
		orderNumber: req.query.orderNumber,
		season: req.query.season,
	};

	const id = req.query.id;
	const specRequiredItems = req.query.requiredItems;
	const specOrderStatus = req.query.orderStatus;

	if (propertyValid(id) && propertyValid(specRequiredItems) && propertyValid(specOrderStatus)) {
		const params = {
        	TableName: process.env.DYNAMODB_ORDER_HEADER_TABLE_NAME,
        	Key: {
            	id: id,
        	},
        	UpdateExpression: 'set #requiredItems = :requiredItems, #orderStatus = :orderStatus',
        	ExpressionAttributeNames: {
            	"#requiredItems": "requiredItems",
            	"#orderStatus": "orderStatus",
        	},
        	ExpressionAttributeValues: {
            	":requiredItems": specRequiredItems,
            	":orderStatus": specOrderStatus,
        	},
    	};

    	dynamoDb.update(params, (error, result) => {
    		if (error) {
    			console.error(error);

    			renderViewOrderStatus2(new RenderObj(viewOrderStatus2Id, req.user.username, orderHeader.customerId, "Unable to modify record.", "red", orderHeader, req, res));
    		} else {
    			renderViewOrderStatus2(new RenderObj(viewOrderStatus2Id, req.user.username, orderHeader.customerId, "Record successfully modified.", "green", orderHeader, req, res));
    		}
    	});
	} else {
		renderViewOrderStatus2(new RenderObj(viewOrderStatus2Id, req.user.username, orderHeader.customerId, "Cannot determine selected record.", "red", orderHeader, req, res));
	}
});

app.post("/view-scans.html", function(req, res) {
	const orderHeader = {
		customerId: req.user.customer_id,
		orderNumber: req.body.orderNumber,
		season: req.body.season,
	};

	//are all required variables defined?
	if (orderHeaderSearchValid(orderHeader)) {
		res.redirect("/view-scans_2.html?orderNumber=" + orderHeader.orderNumber
			+ "&season=" + orderHeader.season);
	} else {
		//flash error
		res.render("view-scans", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/view-export-status.html", function(req, res) {
	const exportHeader = {
		customerId: req.user.customer_id,
		store: req.body.store,
		fromDate: req.body.fromDate,
		toDate: req.body.toDate,
		type: req.body.type,
	};

	//are all required variables defined?
	if (exportHeaderSearchValid(exportHeader)) {
		res.redirect("/view-export-status_2.html?store=" + exportHeader.store
			+ "&fromDate=" + exportHeader.fromDate
			+ "&toDate=" + exportHeader.toDate
			+ "&type=" + exportHeader.type);
	} else {
		//flash error
		res.render("view-export-status", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/view-export-status_2.html/edit", function(req, res) {
	const editableId = req.query.id;

	const exportHeader = {
		customerId: req.user.customer_id,
		store: req.query.store,
		fromDate: req.query.fromDate,
		toDate: req.query.toDate,
		type: req.query.type,
		editableId: editableId,
	};

	if (propertyValid(editableId)) {
		renderViewExportStatus2(new RenderObj(viewExportStatus2Id, req.user.username, exportHeader.customerId, "", "", exportHeader, req, res));
	} else {
		renderViewExportStatus2(new RenderObj(viewExportStatus2Id, req.user.username, exportHeader.customerId, "Cannot determine selected record.", "red", exportHeader, req, res));
	}
});

app.post("/view-export-status_2.html/cancel", function(req, res) {
	const exportHeader = {
		customerId: req.user.customer_id,
		store: req.query.store,
		fromDate: req.query.fromDate,
		toDate: req.query.toDate,
		type: req.query.type,
	};

	renderViewExportStatus2(new RenderObj(viewExportStatus2Id, req.user.username, exportHeader.customerId, "", "", exportHeader, req, res));
});

app.post("/view-export-status_2.html/put", function(req, res) {
	const exportHeader = {
		customerId: req.user.customer_id,
		store: req.query.store,
		fromDate: req.query.fromDate,
		toDate: req.query.toDate,
		type: req.query.type,
	};

	const id = req.query.id;
	const specStatus = req.query.status;

	if (propertyValid(id) && propertyValid(specStatus)) {
		const params = {
        	TableName: process.env.DYNAMODB_EXPORT_HEADER_TABLE_NAME,
        	Key: {
            	id: id,
        	},
        	UpdateExpression: 'set #status = :status',
        	ExpressionAttributeNames: {
            	"#status": "status",
        	},
        	ExpressionAttributeValues: {
            	":status": specStatus,
        	},
    	};

    	dynamoDb.update(params, (error, result) => {
    		if (error) {
    			console.error(error);

    			renderViewExportStatus2(new RenderObj(viewExportStatus2Id, req.user.username, exportHeader.customerId, "Unable to modify record.", "red", exportHeader, req, res));
    		} else {
    			renderViewExportStatus2(new RenderObj(viewExportStatus2Id, req.user.username, exportHeader.customerId, "Record successfully modified.", "green", exportHeader, req, res));
    		}
    	});
	} else {
		renderViewExportStatus2(new RenderObj(viewExportStatus2Id, req.user.username, exportHeader.customerId, "Cannot determine selected record.", "red", exportHeader, req, res));
	}
});

app.post("/view-export-scans.html", function(req, res) {
	const exportHeader = {
		customerId: req.user.customer_id,
		store: req.body.store,
		fromDate: req.body.fromDate,
		toDate: req.body.toDate,
		type: req.body.type,
	};

	//are all required variables defined?
	if (exportHeaderSearchValid(exportHeader)) {
		res.redirect("/view-export-scans_2.html?store=" + exportHeader.store
			+ "&fromDate=" + exportHeader.fromDate
			+ "&toDate=" + exportHeader.toDate
			+ "&type=" + exportHeader.type);
	} else {
		//flash error
		res.render("view-export-scans", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/view-closed-orders.html", function(req, res) {
	const orderHeader = {
		customerId: req.user.customer_id,
		orderNumber: req.body.orderNumber,
		season: req.body.season,
	};

	//are all required variables defined?
	if (strictOrderHeaderSearchValid(orderHeader)) {
		res.redirect("/view-closed-orders_2.html?orderNumber=" + orderHeader.orderNumber
			+ "&season=" + orderHeader.season);
	} else {
		//flash error
		res.render("view-closed-orders", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/view-closed-orders1.html", function(req, res) {
	const exportHeader = {
		customerId: req.user.customer_id,
		store: req.body.store,
		fromDate: req.body.fromDate,
		toDate: req.body.toDate,
		type: req.body.type,
	};

	//are all required variables defined?
	if (exportHeaderSearchValid(exportHeader)) {
		res.redirect("/view-closed-orders1_2.html?store=" + exportHeader.store
			+ "&fromDate=" + exportHeader.fromDate
			+ "&toDate=" + exportHeader.toDate
			+ "&type=" + exportHeader.type);
	} else {
		//flash error
		res.render("view-closed-orders1", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/view-all-users.html", function(req, res) {
	const user = {
		customerId: req.body.businessUnit,
		username: req.body.username,
	};

	//are all required variables defined?
	if (userSearchValid(user)) {
		res.redirect("/view-all-users_2.html?customerId=" + user.customerId
			+ "&username=" + user.username);
	} else {
		//flash error
		res.render("view-all-users", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/view-all-mobile-users.html", function(req, res) {
	const user = {
		customerId: req.body.businessUnit,
	};

	//are all required variables defined?
	if (userSearchValid(user)) {
		res.redirect("/view-all-mobile-users_2.html?customerId=" + user.customerId);
	} else {
		//flash error
		res.render("view-all-users", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/view-all-users_2.html/del", function(req, res) {
	const user = {
		customerId: req.query.customerId,
		username: req.query.username,
	};

	const id = req.query.id;

	if (propertyValid(id)) {
		const params = {
        	TableName: process.env.DYNAMODB_USER_TABLE_NAME,
        	Key: {
            	id: id,
        	},
    	};

    	dynamoDb.delete(params, (error, result) => {
    		if (error) {
    			console.error(error);

    			renderViewAllUsers2(new RenderObj(viewAllUsers2Id, req.user.username, req.user.customer_id, "Unable to delete record.", "red", user, req, res));
    		} else {
    			renderViewAllUsers2(new RenderObj(viewAllUsers2Id, req.user.username, req.user.customer_id, "Record successfully deleted.", "green", user, req, res));
    		}
    	});
	} else {
		renderViewAllUsers2(new RenderObj(viewAllUsers2Id, req.user.username, req.user.customer_id, "Cannot determine selected record.", "red", user, req, res));
	}
});

app.post("/view-all-users_2.html/edit", function(req, res) {
	const editableId = req.query.id;

	const user = {
		customerId: req.query.customerId,
		username: req.query.username,
		editableId: editableId,
	};

	if (propertyValid(editableId)) {
		renderViewAllUsers2(new RenderObj(viewAllUsers2Id, req.user.username, req.user.customer_id, "", "", user, req, res));
	} else {
		renderViewAllUsers2(new RenderObj(viewAllUsers2Id, req.user.username, req.user.customer_id, "Cannot determine selected record.", "red", user, req, res));
	}
});

app.post("/view-all-users_2.html/cancel", function(req, res) {
	const user = {
		customerId: req.query.customerId,
		username: req.query.username,
	};

	renderViewAllUsers2(new RenderObj(viewAllUsers2Id, req.user.username, req.user.customer_id, "", "", user, req, res));
});

app.post("/view-all-users_2.html/put", function(req, res) {
	const user = {
		customerId: req.query.customerId,
		username: req.query.username,
	};

	const id = req.query.id;
	const specActive = req.query.specActive;

	if (propertyValid(id) && propertyValid(specActive)) {
		const params = {
        	TableName: process.env.DYNAMODB_USER_TABLE_NAME,
        	Key: {
            	id: id,
        	},
        	UpdateExpression: 'set #active = :active',
        	ExpressionAttributeNames: {
            	"#active": "active",
        	},
        	ExpressionAttributeValues: {
            	":active": convertToBoolean(specActive),
        	},
    	};

    	dynamoDb.update(params, (error, result) => {
    		if (error) {
    			console.error(error);

    			renderViewAllUsers2(new RenderObj(viewAllUsers2Id, req.user.username, req.user.customer_id, "Unable to modify record.", "red", user, req, res));
    		} else {
    			renderViewAllUsers2(new RenderObj(viewAllUsers2Id, req.user.username, req.user.customer_id, "Record successfully modified.", "green", user, req, res));
    		}
    	});
	} else {
		renderViewAllUsers2(new RenderObj(viewAllUsers2Id, req.user.username, req.user.customer_id, "Cannot determine selected record.", "red", user, req, res));
	}
});

app.post("/view-all-mobile-users_2.html/del", function(req, res) {
	const user = {
		customerId: req.query.customerId,
	};

	const id = req.query.id;

	if (propertyValid(id)) {
		const params = {
        	TableName: process.env.DYNAMODB_USER_TABLE_NAME,
        	Key: {
            	id: id,
        	},
    	};

    	dynamoDb.delete(params, (error, result) => {
    		if (error) {
    			console.error(error);

    			renderViewAllMobileUsers2(new RenderObj(viewAllMobileUsers2Id, req.user.username, req.user.customer_id, "Unable to delete record.", "red", user, req, res));
    		} else {
    			renderViewAllMobileUsers2(new RenderObj(viewAllMobileUsers2Id, req.user.username, req.user.customer_id, "Record successfully deleted.", "green", user, req, res));
    		}
    	});
	} else {
		renderViewAllMobileUsers2(new RenderObj(viewAllMobileUsers2Id, req.user.username, req.user.customer_id, "Cannot determine selected record.", "red", user, req, res));
	}
});

app.post("/view-all-mobile-users_2.html/edit", function(req, res) {
	const editableId = req.query.id;

	const user = {
		customerId: req.query.customerId,
		editableId: editableId,
	};

	if (propertyValid(editableId)) {
		renderViewAllMobileUsers2(new RenderObj(viewAllMobileUsers2Id, req.user.username, req.user.customer_id, "", "", user, req, res));
	} else {
		renderViewAllMobileUsers2(new RenderObj(viewAllMobileUsers2Id, req.user.username, req.user.customer_id, "Cannot determine selected record.", "red", user, req, res));
	}
});

app.post("/view-all-mobile-users_2.html/cancel", function(req, res) {
	const user = {
		customerId: req.query.customerId,
	};

	renderViewAllMobileUsers2(new RenderObj(viewAllMobileUsers2Id, req.user.username, req.user.customer_id, "", "", user, req, res));
});

app.post("/view-all-mobile-users_2.html/put", function(req, res) {
	const user = {
		customerId: req.query.customerId,
	};

	const id = req.query.id;
	const specActive = req.query.specActive;
	const specRole = req.query.specRole;
	const specLanguage = req.query.specLanguage;

	if (propertyValid(id) && propertyValid(specActive) 
		&& propertyValid(specRole) && propertyValid(specLanguage)) {
		const params = {
        	TableName: process.env.DYNAMODB_USER_TABLE_NAME,
        	Key: {
            	id: id,
        	},
        	UpdateExpression: 'set #active = :active, #role = :role, #language = :language',
        	ExpressionAttributeNames: {
            	"#active": "active",
            	"#role": "role",
            	"#language": "language",
        	},
        	ExpressionAttributeValues: {
            	":active": convertToBoolean(specActive),
            	":role": specRole,
            	":language": specLanguage,
        	},
    	};

    	dynamoDb.update(params, (error, result) => {
    		if (error) {
    			console.error(error);

    			renderViewAllMobileUsers2(new RenderObj(viewAllMobileUsers2Id, req.user.username, req.user.customer_id, "Unable to modify record.", "red", user, req, res));
    		} else {
    			renderViewAllMobileUsers2(new RenderObj(viewAllMobileUsers2Id, req.user.username, req.user.customer_id, "Record successfully modified.", "green", user, req, res));
    		}
    	});
	} else {
		renderViewAllMobileUsers2(new RenderObj(viewAllMobileUsers2Id, req.user.username, req.user.customer_id, "Cannot determine selected record.", "red", user, req, res));
	}
});

app.post("/view-all-sites.html", function(req, res) {
	const site = {
		customerId: req.body.businessUnit,
	};

	//are all required variables defined?
	if (siteSearchValid(site)) {
		res.redirect("/view-all-sites_2.html?customerId=" + site.customerId);
	} else {
		//flash error
		res.render("view-all-sites", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/view-all-sites_2.html/del", function(req, res) {
	const site = {
		customerId: req.query.customerId,
	};

	const id = req.query.id;

	if (propertyValid(id)) {
		const params = {
        	TableName: process.env.DYNAMODB_SITE_TABLE_NAME,
        	Key: {
            	identifier: id,
        	},
    	};

    	dynamoDb.delete(params, (error, result) => {
    		if (error) {
    			console.error(error);

    			renderViewAllSites2(new RenderObj(viewAllSites2Id, req.user.username, req.user.customer_id, "Unable to delete record.", "red", site, req, res));
    		} else {
    			renderViewAllSites2(new RenderObj(viewAllSites2Id, req.user.username, req.user.customer_id, "Record successfully deleted.", "green", site, req, res));
    		}
    	});
	} else {
		renderViewAllSites2(new RenderObj(viewAllSites2Id, req.user.username, req.user.customer_id, "Cannot determine selected record.", "red", site, req, res));
	}
});

app.post("/view-all-sites_2.html/edit", function(req, res) {
	const editableId = req.query.id;

	const site = {
		customerId: req.query.customerId,
		editableId: editableId,
	};

	if (propertyValid(editableId)) {
		renderViewAllSites2(new RenderObj(viewAllSites2Id, req.user.username, req.user.customer_id, "", "", site, req, res));
	} else {
		renderViewAllSites2(new RenderObj(viewAllSites2Id, req.user.username, req.user.customer_id, "Cannot determine selected record.", "red", site, req, res));
	}
});

app.post("/view-all-sites_2.html/cancel", function(req, res) {
	const site = {
		customerId: req.query.customerId,
	};

	renderViewAllSites2(new RenderObj(viewAllSites2Id, req.user.username, req.user.customer_id, "", "", site, req, res));
});

app.post("/view-all-sites_2.html/put", function(req, res) {
	const site = {
		customerId: req.query.customerId,
	};

	const id = req.query.id;
	const specAppVersion = req.query.specAppVersion;

	if (propertyValid(id) && propertyValid(specAppVersion)) {
		const params = {
        	TableName: process.env.DYNAMODB_SITE_TABLE_NAME,
        	Key: {
            	identifier: id,
        	},
        	UpdateExpression: 'set #appVersion = :appVersion',
        	ExpressionAttributeNames: {
            	"#appVersion": "appVersion",
        	},
        	ExpressionAttributeValues: {
            	":appVersion": specAppVersion,
        	},
    	};

    	dynamoDb.update(params, (error, result) => {
    		if (error) {
    			console.error(error);

    			renderViewAllSites2(new RenderObj(viewAllSites2Id, req.user.username, req.user.customer_id, "Unable to modify record.", "red", site, req, res));
    		} else {
    			renderViewAllSites2(new RenderObj(viewAllSites2Id, req.user.username, req.user.customer_id, "Record successfully modified.", "green", site, req, res));
    		}
    	});
	} else {
		renderViewAllSites2(new RenderObj(viewAllSites2Id, req.user.username, req.user.customer_id, "Cannot determine selected record.", "red", site, req, res));
	}
});

app.post("/view-all-stores.html", function(req, res) {
	const store = {
		storeIdentifier: req.body.storeIdentifier,
	};

	//are all required variables defined?
	if (storeSearchValid(store)) {
		res.redirect("/view-all-stores_2.html?storeIdentifier=" + store.storeIdentifier);
	} else {
		//flash error
		res.render("view-all-stores", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/view-all-stores_2.html/del", function(req, res) {
	const store = {
		storeIdentifier: req.query.storeIdentifier,
	};

	const id = req.query.id;

	if (propertyValid(id)) {
		const params = {
        	TableName: process.env.DYNAMODB_STORE_TABLE_NAME,
        	Key: {
            	storeIdentifier: id,
        	},
    	};

    	dynamoDb.delete(params, (error, result) => {
    		if (error) {
    			console.error(error);

    			renderViewAllStores2(new RenderObj(viewAllStores2Id, req.user.username, req.user.customer_id, "Unable to delete record.", "red", store, req, res));
    		} else {
    			renderViewAllStores2(new RenderObj(viewAllStores2Id, req.user.username, req.user.customer_id, "Record successfully deleted.", "green", store, req, res));
    		}
    	});
	} else {
		renderViewAllStores2(new RenderObj(viewAllStores2Id, req.user.username, req.user.customer_id, "Cannot determine selected record.", "red", store, req, res));
	}
});

app.post("/add-supplier.html", function(req, res) {
	const user = {
		customerId: req.body.supplierId,
		username: req.body.username,
		password: req.body.password,
		active: convertToBoolean(req.body.active),
		language: req.body.language,
	};

	//are all required variables defined?
	if (userValid(user)) {
		//do the password match?
		if (user.password === req.body.confirmPassword) {
			const params = {
        		TableName: process.env.DYNAMODB_USER_TABLE_NAME,
        		Item: {
            		id: uuid.v1(),
            		customer_id: user.customerId,
            		username: user.username,
            		password: user.password,
            		active: user.active,
            		language: user.language,
            		mobileUser: false,
            		role: 'Supplier',
        		},
    		};

    		dynamoDb.put(params, (error) => {
    			if (error) {
            		console.error(error);
            		//flash error
            		res.render("add-supplier", {
						username: req.user.username,
						customerId: req.user.customer_id,
						status: "Error inserting into db.",
						statusColour: "red",
					});
        		} else {
        			//flash success
        			res.render("add-supplier", {
						username: req.user.username,
						customerId: req.user.customer_id,
						status: "Your submission was successful.",
						statusColour: "green",
					});
        		}
    		});
		} else {
			//flash error
			res.render("add-supplier", {
				username: req.user.username,
				customerId: req.user.customer_id,
				status: "Passwords do not match.",
				statusColour: "red",
			});
		}
	} else {
		//flash error
		res.render("add-supplier", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/add-exporter.html", function(req, res) {
	const user = {
		customerId: req.body.exporterId,
		username: req.body.username,
		password: req.body.password,
		active: convertToBoolean(req.body.active),
		language: req.body.language,
	};

	//are all required variables defined?
	if (userValid(user)) {
		//do the password match?
		if (user.password === req.body.confirmPassword) {
			const params = {
        		TableName: process.env.DYNAMODB_USER_TABLE_NAME,
        		Item: {
            		id: uuid.v1(),
            		customer_id: user.customerId,
            		username: user.username,
            		password: user.password,
            		active: user.active,
            		language: user.language,
            		mobileUser: false,
            		role: 'Export',
        		},
    		};

    		dynamoDb.put(params, (error) => {
    			if (error) {
            		console.error(error);
            		//flash error
            		res.render("add-exporter", {
						username: req.user.username,
						customerId: req.user.customer_id,
						status: "Error inserting into db.",
						statusColour: "red",
					});
        		} else {
        			//flash success
        			res.render("add-exporter", {
						username: req.user.username,
						customerId: req.user.customer_id,
						status: "Your submission was successful.",
						statusColour: "green",
					});
        		}
    		});
		} else {
			//flash error
			res.render("add-exporter", {
				username: req.user.username,
				customerId: req.user.customer_id,
				status: "Passwords do not match.",
				statusColour: "red",
			});
		}
	} else {
		//flash error
		res.render("add-exporter", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/add-store.html", function(req, res) {
	const store = {
		storeIdentifier: req.body.storeIdentifier,
		storeName: req.body.storeName,
	};

	//are all required variables defined?
	if (storeValid(store)) {
		const params = {
    		TableName: process.env.DYNAMODB_STORE_TABLE_NAME,
    		Item: {
        		storeIdentifier: store.storeIdentifier,
        		storeName: store.storeName,
    		},
		};

		dynamoDb.put(params, (error) => {
			if (error) {
        		console.error(error);
        		//flash error
        		res.render("add-store", {
					username: req.user.username,
					customerId: req.user.customer_id,
					status: "Error inserting into db.",
					statusColour: "red",
				});
    		} else {
    			//flash success
    			res.render("add-store", {
					username: req.user.username,
					customerId: req.user.customer_id,
					status: "Your submission was successful.",
					statusColour: "green",
				});
    		}
		});
	} else {
		//flash error
		res.render("add-store", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/system-log.html", function(req, res) {
	const systemLog = {
		businessUnit: req.body.businessUnit,
	};

	//are all required variables defined?
	if (systemLogSearchValid(systemLog)) {
		res.redirect("/system-log_2.html?businessUnit=" + systemLog.businessUnit);
	} else {
		//flash error
		res.render("system-log", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.post("/extracted-orders.html", function(req, res) {
	const order = {
		orderNumber: req.body.orderNumber,
		season: req.body.season,
		supplierCode: req.body.supplierCode,
		orderStatus: req.body.orderStatus,
	};

	//are all required variables defined?
	if (orderSearchValid(order)) {
		res.redirect("/extracted-orders_2.html?orderNumber=" + order.orderNumber
			+ "&season=" + order.season
			+ "&supplierCode=" + order.supplierCode
			+ "&orderStatus=" + order.orderStatus);
	} else {
		//flash error
		res.render("extracted-orders", {
			username: req.user.username,
			customerId: req.user.customer_id,
			status: "Values in one or more fields are invalid.",
			statusColour: "red",
		});
	}
});

app.listen(process.env.PORT, function() {
	console.log("Server started on port " + process.env.PORT);
});
