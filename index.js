(function() {
	"use strict"

	const fs = require("fs"),
		readline = require("readline"),
		blockString = (block,encoding="utf8") => {
			return "[" + bytePadEnd(block[0]+"",20," ",encoding) + "," + bytePadEnd(block[1]+"",20," ",encoding) + "]";
		},
		bytePadEnd = (str,length,pad,encoding="utf8") => {
			const needed = length - Buffer.byteLength(str,encoding);
			if(needed>0) return str + Buffer.alloc(needed," ",encoding).toString(encoding);
			return str;
		};
	function asynchronize(f) {
		const args = [].slice.call(arguments,1);
		return new Promise((resolve,reject) => {
			f(...args,(err,result) => {
				if(err) {
					console.log(err);
					reject(err);
				}
				else resolve(result);
			});
		}).then(data => [null,data]).catch(err => [err]);
	}

	function JSONBlockStore(path,keyProperty,clear) {
		this.path = path;
		this.encoding = "utf8";
		this.opened = false;
		if(clear) this.clear();
	}
	JSONBlockStore.prototype.open = async function() { // also add a transactional file class <file>.json, <file>.queue.json, <file>.<line> (line currently processing), <file>.done.json (lines processed)
			let err, fd
			[err,fd] = await asynchronize(fs.open,this.path + "/free.json","r+");
			if(err) [err,fd] = await asynchronize(fs.open,this.path + "/free.json","w+");
			this.freefd = fd;
			[err,fd] = await asynchronize(fs.open,this.path + "/blocks.json","r+");
			if(err) [err,fd] = await asynchronize(fs.open,this.path + "/blocks.json","w+");
			this.blocksfd = fd;
			[err,fd] = await asynchronize(fs.open,this.path + "/store.json","r+");
			if(err) [err,fd] = await asynchronize(fs.open,this.path + "/store.json","w+");
			this.storefd = fd;
			let blocks, freestat, blockstat, storestat;
			[err,blocks] = await asynchronize(fs.readFile,this.path + "/blocks.json",this.encoding),  // {<id>:{start:start,end:end,length:length}[,...]}
			[err,freestat] = await asynchronize(fs.fstat,this.freefd);
			[err,blockstat] = await asynchronize(fs.fstat,this.blocksfd);
			[err,storestat] = await asynchronize(fs.fstat,this.storefd);
			let free;
			[err,free] = await asynchronize(fs.readFile,this.path + "/free.json",this.encoding); // [{start:start,end:end,length:length}[,...]]
			if(free.length===0) {
				this.free = [];
			} else {
				free = free.trim();
				if(free[0]===",") free = free.substring(1);
				if(free[free.length-1]===",") free = free.substring(0,free.length-1);
				this.free= JSON.parse("["+free+"]");
			}
			this.blocks = (blocks.length>0 ? JSON.parse(blocks) : {});
			this.freeSize = freestat.size;
			this.blocksSize = blockstat.size;
			this.storeSize = storestat.size;
			this.opened = true;
			return true;
		}
	JSONBlockStore.prototype.load = async function(start=0,end=start+1) {
		return new Promise((resolve,reject) => {
			const result = [],
				filename = this.path + "/store.json";
			let i = 0;
			const rl = readline.createInterface({
			    input: fs.createReadStream(filename),
			    terminal: false
			}).on('line', line => {
			   if(i>=start && i<end) result.push(JSON.parse(line.replace(/\000/g,"")));
			   if(i===end) rl.close();
			   i++;
			}).on('close',() => {
				resolve(result);
			});
		});
	}
	JSONBlockStore.prototype.alloc = async function(length,encoding="utf8") {
			const me = this;
			let block;
			if(!me.alloc.size) {
				me.alloc.size = Buffer.byteLength(blockString([0,0],encoding),encoding);
				me.alloc.empty = bytePadEnd("null",me.alloc.size," ",encoding);
			}
			for(var i=0;i<me.free.length;i++) {
				block = me.free[i];
				if(block && block[1]-block[0]>=length) {
					let position = ((me.alloc.size+1) * i);
					me.free[i] = null;
					await asynchronize(fs.write,me.freefd,me.alloc.empty,position,encoding);
					return block;
				}
			}
			let start = (me.storeSize===0 ? 0 : me.storeSize+1);
			return [start, start+length];
		}
	JSONBlockStore.prototype.clear = async function() {
			if(!this.opened) {
				this.open();
			}
			await asynchronize(fs.ftruncate,this.freefd);
			await asynchronize(fs.ftruncate,this.blocksfd);
			await asynchronize(fs.ftruncate,this.storefd);
			this.freeSize = 0;
			this.blocksSize = 0;
			this.storeSize = 0;
			this.free = [];
			this.blocks = {};
		}
	JSONBlockStore.prototype.compress =	async function() {
			const me = this;
			if(!me.opened) {
				await me.open();
			}
			let newfree = [];
			me.freeSize = 0;
			for(let i=0;i<me.free.length;i++) {
				const block = me.free[i];
				if(block) {
					newfree.push(block);
					let str = blockString(block,me.encoding)+",";
					await asynchronize(fs.write,me.freefd,str,me.freeSize,me.encoding);
					me.freeSize += Buffer.byteLength(str,me.encoding);
				}
			}
			me.free = newfree;
			await asynchronize(fs.ftruncate,me.freefd,me.freeSize);
			me.blocksSize = 1;
			me.storeSize = 0;
			await asynchronize(fs.write,me.blocksfd,"{",0,me.encoding);
			const blockkeys = Object.keys(me.blocks);
			for(let key of blockkeys) {
				let str = '"'+key+'":' + JSON.stringify(me.blocks[key])+",";
				await asynchronize(fs.write,me.blocksfd,str,me.blocksSize,me.encoding);
				me.blocksSize += Buffer.byteLength(str,me.encoding);
			}
			await asynchronize(fs.write,me.blocksfd,"}",me.blocksSize-1,me.encoding);
			await asynchronize(fs.ftruncate,me.blocksfd,me.blocksSize);
		}
	JSONBlockStore.prototype.delete = async function(id) {
			const me = this;
			if(!me.opened) await me.open();
			const block = me.blocks[id];
			if(block) {
				const blanks = bytePadEnd("",block[1]-block[0],me.encoding);
				delete me.blocks[id];
				await asynchronize(fs.write,me.storefd,blanks,block[0],"utf8"); // write blank padding
				me.free.push(block);
				let str = blockString(block,me.encoding)+",";
				await asynchronize(fs.write,me.freefd,str,me.freeSize,me.encoding);
				me.freeSize += Buffer.byteLength(str,me.encoding);
				str = (me.blocksSize===0 ? '{' : ',')+'"'+id+'":null}';
				const fposition = (me.blocksSize===0 ? 0 : me.blocksSize-1);
				await asynchronize(fs.write,me.blocksfd,str,fposition,me.encoding);
				me.blocksSize = fposition + Buffer.byteLength(str,me.encoding);
			}
		}
	JSONBlockStore.prototype.get = async function(id) {
		const me = this;
		if(!me.opened) await me.open();
		const block = me.blocks[id];
		if(block) {
			const buffer = Buffer.alloc(block[1]-block[0]);
			await asynchronize(fs.read,me.storefd,buffer,0,block[1]-block[0],block[0]);
			try {
				const str = buffer.toString(),
					result = JSON.parse(str.substring(0,str.lastIndexOf("\n")));
				return result.value;
			} catch(e) {
				console.log(e,buffer.toString());
			}
			//return super.restore(result.value);
		}
	}
	JSONBlockStore.prototype.set = async function(id,data) {
			const me = this;
			if(!me.opened) await me.open();
			const block = me.blocks[id];
			let str = '{"id":"'+id+'","value":'+JSON.stringify(data)+'}\n';
			const blen = Buffer.byteLength(str, 'utf8');
			if(block) { // if data already stored
				if((block[0] + blen) - 1 < block[1]) { // and update is same or smaller
					await asynchronize(fs.write,me.storefd,bytePadEnd(str,(block[1]-block[0]),me.encoding),block[0],me.encoding); // write the data with blank padding
					return;
				}
			}
			const freeblock = await me.alloc(blen,me.encoding); // find a free block large enough
			await asynchronize(fs.write,me.storefd,bytePadEnd(str,(freeblock[1]-freeblock[0]),me.encoding),freeblock[0]); // write the data with blank padding
			me.storeSize = Math.max(freeblock[1],me.storeSize);
			me.blocks[id] = freeblock; // update the blocks info
			if(block) { // free old block which was too small, if there was one
				await asynchronize(fs.write,me.storefd,bytePadEnd("",(block[1]-block[0])," "),block[0],me.encoding); // write blank padding
				me.free.push(block);
				str = blockString(block,me.encoding)+",";
				await asynchronize(fs.write,me.freefd,str,me.freeSize,me.encoding);
				me.freeSize += Buffer.byteLength(str,me.encoding);
			}
			str = (me.blocksSize===0 ? '{' : ',')+'"'+id+'":'+JSON.stringify(freeblock)+"}";
			const fposition = (me.blocksSize===0 ? 0 : me.blocksSize-1);
			await asynchronize(fs.write,me.blocksfd,str,fposition,me.encoding);
			me.blocksSize = fposition + Buffer.byteLength(str,me.encoding);
		}
	module.exports = JSONBlockStore;
}).call(this);