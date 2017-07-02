(function() {
	"use strict"
	const BlockStore = require("blockstore");

	class JSONBlockStore extends BlockStore {
		constructor(path,clear) {
			super(path,clear);
		}
		async get(id,block=[]) {
			const buffer = await super.get(id,block);
			if(buffer) return JSON.parse(buffer.toString().replace(/[\0\n]/g,"").trim());
		}
		async set(id,data) {
			super.set(id,JSON.stringify(data)+"\n");
		}
	}
	module.exports = JSONBlockStore;
}).call(this);