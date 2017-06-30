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
	const testsize = 1000;
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
	start = Date.now();
	for(let i=0;i<testsize;i++) {
		await bstore.get(i);
	}
	end = Date.now();
	console.log("Read Records Sec:", testsize / ((end-start)/1000));
	console.log(await bstore.get(testsize/2));
}
test();




