const JSONBlockStore = require("../index.js"),
	bstore = new JSONBlockStore("./test/data","id",true);

async function test() {
	await bstore.open();
	await bstore.set("1",{name:"Joe",age:27});
	let one = await bstore.get("1");
	console.log(one);
	await bstore.set("1",{name:"Joe",age:28});
	one = await bstore.get("1");
	console.log(one);
	const testsize = 20000;
	for(let i=0;i<testsize;i++) {
		await bstore.set("1",{name:"Joe",age:27});
	}
	console.log("Updates with no change OK")
	for(let i=0;i<testsize;i++) {
		await bstore.set("1",{name:"Joe",age:i});
	}
	console.log("Updates with change OK");
	
	let start = Date.now();
	for(let i=0;i<testsize;i++) {
		await bstore.set(i+"",{name:"Joe",age:i,address:{city:"Seattle"}});
	}
	let end = Date.now();
	console.log("Write Records Sec:", testsize / ((end-start)/1000));
	console.log("Adds OK");
	let content = await bstore.load(0,20);
	console.log(content);
	content = await bstore.load(1);
	console.log(content);
	start = Date.now();
	content = await bstore.load(0,testsize);
	end = Date.now();
	console.log("Read Records Sec:", testsize / ((end-start)/1000));
	console.log(content);
}

test();




