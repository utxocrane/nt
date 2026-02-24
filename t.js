const axios = require('axios')
const fs = require('fs')
const path=require('path')

function fromBase64(bstr){return Buffer.from(bstr, 'base64').toString('utf-8')}

async function updateList() {
	let allTxt = ''

	//free-nodes/v2rayfree
	try {
    	const response = await axios.get('https://raw.githubusercontent.com/free-nodes/v2rayfree/main/README.md')
		let txt = response.data
		let si = txt.indexOf('```')+4,ei = txt.lastIndexOf('```')
		allTxt = txt.substr(si,ei-si).trim().replaceAll('&amp;','&')+'\n'
	  	
	    console.log('订阅长度'+allTxt.length)
	} catch (error) {console.error('free-nodes请求失败:', error.message);}

	//common base64 suburls
	const suburls=[
		'https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub',
		'https://raw.githubusercontent.com/chengaopan/AutoMergePublicNodes/master/list.txt',
		'https://raw.githubusercontent.com/snakem982/proxypool/main/source/v2ray-2.txt',
		'https://raw.githubusercontent.com/Barabama/FreeNodes/main/nodes/yudou66.txt'
		//https://raw.githubusercontent.com/adiwzx/freenode/main/adispeed.txt //这个自ID-10086/freenode导流的订阅已全部失效，后续再跟踪
		//crossxx-labs/free-proxy是clash格式订阅，看看有无免费转换方案
	]
	
	for(const u of suburls){
		try{
			allTxt += fromBase64((await axios.get(u)).data).trim()+'\n'
			console.log(u,'读取后', allTxt.length);
		}
		catch (error) {console.error('u读取失败:', error.message);}
	}

	//html match
	const htmlPages=[
		
	]
	
	fs.writeFileSync(path.join(process.cwd(),'v'), Buffer.from(allTxt.trim()).toString('base64'));
}

updateList()
