const axios = require('axios')
const fs = require('fs')
const path=require('path')
const cheerio = require('cheerio')

function fromBase64(bstr){return Buffer.from(bstr, 'base64').toString('utf-8')}

function extractUrlsSmart(html) {
  const $ = cheerio.load(html);
  const urlPattern = /[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/[^\s"'<>]+/g;
  
  // 先移除所有不希望提取内容的标签
  $('script, style, noscript').remove();
  
  // 获取所有文本内容
  const text = $('body').text();
  
  // 提取URL并去重
  const urls = [...new Set(text.match(urlPattern) || [])];
  
  return urls;
}

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

	/////////////////common base64 suburls
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
			let ut = (await axios.get(u)).data
			allTxt += ((ut.indexOf(':/')<0) ? fromBase64(ut) : ut).trim()+'\n'
			console.log(u,'读取后', allTxt.length);
		}
		catch (error) {console.error('u读取失败:', error.message);}
	}

	//////////////包含节点URL的普通html(如vless|trojan://....)
	const htmlPages=[
		'https://github.com/Alvin9999-newpac/fanqiang/wiki/v2ray%E5%85%8D%E8%B4%B9%E8%B4%A6%E5%8F%B7'
		
	]

	for(const u of htmlPages){
		try{
			let allurls = extractUrlsSmart((await axios.get(u)).data)
			for(const u1 of allurls)
				if(!u1.startsWith('http'))
					allTxt += u1.trim()+'\n'

			console.log(u,'解析后', allTxt.length)
		}
		catch (error) {console.error(u,'html解析节点链接失败:', error.message);}
	}
	
	
	fs.writeFileSync(path.join(process.cwd(),'v'), Buffer.from(allTxt.trim()).toString('base64'));
}

updateList()
